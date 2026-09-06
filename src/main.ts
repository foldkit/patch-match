import {
  Array,
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Random,
  Schema,
} from 'effect'
import { Command, Runtime, type Update } from 'foldkit'
import { Document, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'
import { evo } from 'foldkit/struct'
import * as Tone from 'tone'

import { Button } from '@foldkit/ui'

// RESOURCE

const makeSynth = Effect.gen(function*() {
  const synth = yield* Effect.acquireRelease(
    Effect.sync(() => new Tone.Synth().toDestination()),
    synth => Effect.sync(() => synth.dispose()),
  )
  return synth
})

export class SynthService extends Context.Service<
  SynthService,
  Tone.Synth<Tone.SynthOptions>
>()('SynthService') {
  static readonly Default = Layer.effect(this, makeSynth)
}

// MODEL

const Note = Schema.Literals([
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
])

const playableNote: Record<typeof Note.Type, string> = {
  C: 'C4',
  Db: 'Db4',
  D: 'D4',
  Eb: 'Eb4',
  E: 'E4',
  F: 'F4',
  Gb: 'Gb4',
  G: 'G4',
  Ab: 'Ab4',
  A: 'A4',
  Bb: 'Bb4',
  B: 'B4',
}

const Sequence = Schema.Array(Schema.Option(Note))
const NonEmptySequence = Schema.NonEmptyArray(Schema.Option(Note))

const GameState = defineTaggedUnion({
  Initial: {},
  InProgress: { sequence: NonEmptySequence },
})

const gameStateToLabel = (gameState: typeof GameState.Type): string =>
  GameState.match(gameState, {
    Initial: () => 'Initial',
    InProgress: () => 'In Progress',
  })

export const Model = Schema.Struct({ gameState: GameState })
export type Model = typeof Model.Type

// MESSAGE

export const Message = defineMessageUnion({
  ClickedStart: {},
  CompletedGenerateSequence: { sequence: NonEmptySequence },
  ClickedPlay: { sequence: NonEmptySequence },
  CompletedPlayNote: { remainingSequence: Sequence },
})
export type Message = typeof Message.Type

// COMMAND

const GRID_LENGTH = 16

const NUNS_COUNT = 8

const nuns = Array.makeBy(NUNS_COUNT, Option.none)

const choices = [...Array.map(Note.literals, Option.some), ...nuns]

const generateSequence: Effect.Effect<typeof NonEmptySequence.Type> = Effect.all(
  Array.map(Array.range(0, GRID_LENGTH - 1), () =>
    Random.choice(choices).pipe(Effect.catch(() => Effect.succeedNone)),
  ),
)

const GenerateSequence = Command.define('GenerateSequence', {
  messages: [Message.CompletedGenerateSequence],
  execute: Effect.gen(function*() {
    const sequence = yield* generateSequence
    return Message.CompletedGenerateSequence({ sequence })
  }),
})

const DELAY_BETWEEN_NOTES = Duration.millis(300)

const PlayNote = Command.define('PlaySequence', {
  args: { nonEmptyRemainingSequence: NonEmptySequence },
  messages: [Message.CompletedPlayNote],
  execute: ({ nonEmptyRemainingSequence }) =>
    Effect.gen(function*() {
      const synth = yield* SynthService
      const now = yield* Effect.sync(() => Tone.now())
      const maybeNote = Array.headNonEmpty(nonEmptyRemainingSequence)

      if (Option.isSome(maybeNote)) {
        yield* Effect.sync(() =>
          synth.triggerAttack(playableNote[maybeNote.value], now),
        )
      }

      yield* Effect.sleep(DELAY_BETWEEN_NOTES)

      const newNow = yield* Effect.sync(() => Tone.now())
      yield* Effect.sync(() =>
        synth.triggerRelease(newNow),
      )

      return Message.CompletedPlayNote({
        remainingSequence: Array.tailNonEmpty(nonEmptyRemainingSequence),
      })
    }),
})

// UPDATE

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message, SynthService>>(message, {
    ClickedStart: () => ({
      model,
      commands: [GenerateSequence()],
    }),
    CompletedGenerateSequence: ({ sequence }) => ({
      model: evo(model, {
        gameState: () => GameState.InProgress({ sequence }),
      }),
    }),
    ClickedPlay: ({ sequence }) => ({
      model,
      commands: [PlayNote({ nonEmptyRemainingSequence: sequence })],
    }),
    CompletedPlayNote: ({ remainingSequence }) => {
      return Array.match(remainingSequence, {
        onEmpty: () => ({ model }),
        onNonEmpty: nonEmptyRemainingSequence => ({
          model,
          commands: [
            PlayNote({ nonEmptyRemainingSequence }),
          ],
        }),
      })
    },
  })

// INIT

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: { gameState: GameState.Initial() },
})

// VIEW

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Patch Match',
  body: h.div(
    [
      h.Class(
        'min-h-screen bg-white flex flex-col items-center justify-center gap-6 p-6',
      ),
    ],
    [
      h.p(
        [h.Class('text-3xl font-bold text-gray-800')],
        [`Game State: ${gameStateToLabel(model.gameState)}`],
      ),
      h.div(
        [h.Class('flex flex-wrap justify-center gap-4')],
        [
          GameState.match(model.gameState, {
            Initial: () => initialView(h),
            InProgress: inProgress => inProgressView(inProgress, h),
          }),
        ],
      ),
    ],
  ),
})

const initialView = (h: HtmlBuilder<Message>) =>
  Button.view(
    {
      onClick: Message.ClickedStart(),
      toView: attributes =>
        h.button([...attributes.button, h.Class(buttonStyle)], ['Start']),
    },
    h,
  )

const inProgressView = (
  { sequence }: typeof GameState.InProgress.Type,
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [],
    [
      h.ul(
        [h.Class('flex gap-x-3')],
        Array.map(sequence, maybeNote =>
          h.li(
            [],
            [
              Option.match(maybeNote, {
                onNone: () => '-',
                onSome: note => note,
              }),
            ],
          ),
        ),
      ),
      Button.view(
        {
          onClick: Message.ClickedPlay({ sequence }),
          toView: attributes =>
            h.button([...attributes.button, h.Class(buttonStyle)], ['Play']),
        },
        h,
      ),
    ],
  )

// STYLE

const buttonStyle = 'bg-black text-white hover:bg-gray-700 px-4 py-2 transition'
