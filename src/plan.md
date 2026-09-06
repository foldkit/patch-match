Patch Match!

A game where you hear a sequence of notes played by a synthesizer and try to
match it.

## Overview

The goal of the game is to get as close to the randomly generated sequence and
synthesizer patch as possible.

Maybe there are easy/medium/hard difficulties. We can start by building using
the easy difficulty level, which means you get to hear the sequence played as
many times as you want. With medium and hard difficult you have increasingly
limited replays.

A grid contains 16 steps. A sequence contains 8 notes distributed across the
steps. So we'll need to generate an optional note for each step in the grid,
with a maximum of 8 notes (so max 8 Option.some(note)). Or maybe a required 8.

We'll use Tone.js for playing audio. We'll put this behind a Resource or a
Managed Resource in Foldkit. Commands can yield* from the Resource and use it to
play notes.

The user will see a grid on which they can place notes and a simple synthesizer
interface with ADSR, wave selection, and potentially reverb/delay.

We can start by randomly generating the target sequence when the game starts.

Application initializes -> user starts game -> random target sequence generates
-> user plays random target sequence -> user inputs guess sequence on grid and
synth settings -> user can play guess sequence -> user submits when ready ->
score is calculated against guess sequence -> game ends

## Scoring Algorithm

Target: C - - C - D - E - Gb D Bb - - D -

Guess: D - - C - D - F - Ab - Bb C - D -

How to approach this?
