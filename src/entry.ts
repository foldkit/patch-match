import { Runtime } from 'foldkit'

import { Message, Model, SynthService, init, update, view } from './main'

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  container: document.getElementById('root'),
  resources: SynthService.Default,
  devTools: {
    Message,
  },
})

Runtime.run(application)
