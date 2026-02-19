// Machine exported from https://stately.ai/registry/editor/8af147fe-cc57-4ce0-98e2-a1d80a3416f7?machineId=00ac43cb-b721-4c65-9b69-17d85be9cb29&mode=Design

import { setup } from 'xstate';

export const stageMachine = setup({
  types: {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    context: {} as {},
    events: {} as
      | { type: 'end'; score: number }
      | { type: 'back' }
      | { type: 'start' }
      | { type: 'menu' }
      | { type: 'next' }
      | { type: 'play' }
      | { type: 'quit' }
      | { type: 'save'; name: string }
      | { type: 'pause' }
      | { type: 'resume' }
      | { type: 'leaderboard' }
      | { type: 'controllersReady' }
      | { type: 'controllerDisconnected' }
      | { type: 'debugStart' },
  },
  actions: {
    hideLoadingOverlay: () => {},
    navigateToLoadingErrorPage: () => {},
    setupLoadingScreen: () => {},
    setupScreens: () => {},
  },
  actors: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadResources: undefined as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    waitForLowPriorityResources: undefined as any,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QGUAuBDGA6N6BOqAxLBgQNoAMAuoqAA4D2sAlqswwHa0gAeiALADYsAdgCsAZgBMAThHSRMgBz8AjKv4AaEAE9EqiWKz8JypYKkUxBpeIC+d7bmy4CAAgA2DdBGYcohBCcYFh+AG4MANYhzjGkqJ7evv4I4QwAxuhsnJRUudyMLNlcSLyIMhJYVhIUSjIyUlKqFBQSEtp6CAC0Evz8WNZKSjUU-LVjSg5OGC7xiT5+AWB4eAx4WHQeWQBmawC2ODNx+AleCylpmcW5+aWFrOwloHwIbcLNFCJ1qg1iMoJaXSILr8ETCVotVRDOoiIRSQRTECxLAAWTAHAAroRNugdLd6EwHpxuC8pCIKFglLVTFJTCoyWIOog3lgFBJbBQDBQpFT+IjkWjMYQPGAfMsAEbePAQfEge7FEn6VQiAZiQRKVSCAzswS1JkICwyAYyay6-iWfgmqT8o5YAAqGNQa2Y6A8hHF6HSkVl8seioQ8KUWFkgjEImagnJtSU+qkaspYNDVP+tM+NswIQdTrwLrdOLx1AKhIVpReutUAwBo3D-DEn1UjKBrwkwjZHK5ZIq6ewABlRRAJVKIIQ9uiMT7i37S4gmv0I2GKDIbJaLPqxGpjH0-mpubZBDJuyE+2EwHn0BjYGAJ0Up89EOYjHGxmJ4QCJBpVPqWW3yR3Jo4kVtY9T0IdEZULO5J2JacECXfotQkcMRBDM1AU6dcKz6WtBF6MQXx1Q8sAABXPS9CDwOAMVHa8iSeMoEHMCkyWjWk5BaGQ0JneM9yTRcLBqMFCJIi8wEIABHDFWBoks7wY+RWU1DREJUUFDH1c1+jwuNLDpRcGgRADkWQdI1lEjgwB4VBpNveitX6T4KiaelJDVfUEMpS1uQBKkaj5QzbWM0ziHQE9rOg2SOWMQRoo1RRlBadom3ECtenEaRWg0Ml-2mDMcBCxY3FgEyKMIczLLCuiXhfYRlD+BplUGUZ9WS1lQTVP5YVDHDCJ7JJFkCYJQg4CJokOXLevOKBUmGjIskeG4IIJG9wvo-ggw1Djt0sChdU+fUQQrF8lEkGROS+BKRB6vr-FAlY1g2LZUF2PADmRCbkimy45pyagKv9FsjHEByfnJAE432hsjDqaolHhclLWUBwAI4BgB3gUpYiLZbKuBVQpCwE06z4taXNOwR9vLVVbHhBHPnDQjXFQLHaP9PGjVpDVOTGKwOIMdSgx+EYOYqKkpD8nLZhOeYPuZmT6OQ1VemVdL32+fbrH6Sx92kc0zqsQjBQxWWbJeNng3ZZoNBabc+abFkrGQzlag4zsDIlzNHWdV1jZWl5udZPD5HVZovi1L8DEpWH6lqOtTpEeQev7Qd8AgH2cdeMNgz+MQqRwl3ZEbTpDVZOMdthvowTwxOTw8NP-XDSpzFhvGWzablPztlsqjDWQ1sQ2RYYkITSLAOuYPqKGwX+NvmM1cPG+GZoTXfcQhAZ4rR8g7H-TkTWGyXfeyTWtzPiwBtPjBnPELEBn8v8QqN7H2T1Xx6R2U5Jp1E7ZrrCqePVMUHUeEN9-LjWulANwyxVh4CfvRMMwgxaGH3kuSwfx1acmDA2KMVgDAvgPKA3s4DYEvEMFUPo0ckFCDGBxCGHEqiRlrAoMm74h5IyAA */
  context: {},

  id: 'Stage',
  initial: 'Start loading',

  states: {
    Start: {
      on: {
        start: {
          target: 'Menu',
          description: 'Very first user interaction,\\\nrequired to be able to start the music.',
          reenter: true,
        },
        debugStart: {
          target: 'Level',
        },
      },
    },

    'Start loading': {
      invoke: {
        src: 'loadResources',

        onDone: {
          target: 'Loading',
          reenter: true,
          actions: 'setupLoadingScreen',
        },

        onError: {
          target: 'Loading error',
          reenter: true,
        },
      },

      exit: ['hideLoadingOverlay'],
    },

    Menu: {
      on: {
        play: {
          target: 'Tutorial',
        },
        leaderboard: {
          target: 'Leaderboard',
        },
      },
    },

    Tutorial: {
      on: {
        back: {
          target: 'Menu',
        },
        play: {
          target: 'WaitingForControllers',
        },
      },
      description: 'Display the commands',
    },

    WaitingForControllers: {
      on: {
        controllersReady: {
          target: 'Level',
        },
        back: {
          target: 'Tutorial',
        },
      },
      description: 'Wait for 2 controllers to be connected',
    },

    Leaderboard: {
      on: {
        menu: {
          target: 'Menu',
        },
      },
    },

    Level: {
      on: {
        pause: {
          target: 'Pause',
        },
        end: {
          target: 'Score',
        },
        controllerDisconnected: {
          target: 'Pause',
        },
      },
    },

    Pause: {
      on: {
        resume: {
          target: 'Level',
        },
        quit: {
          target: 'Menu',
        },
      },
      description: 'Offer to quit, and display the commands',
    },

    Score: {
      on: {
        next: {
          target: 'Leaderboard',
          description: 'Go to the leaderboard without saving',
        },
        save: {
          target: 'Saving score',
        },
      },
      description: 'Display the score, and ask for a name to record',
    },

    'Saving score': {
      on: {
        next: {
          target: 'Leaderboard',
        },
      },
    },

    'Loading error': {
      entry: 'navigateToLoadingErrorPage',
    },

    Loading: {
      invoke: {
        src: 'waitForLowPriorityResources',
        onDone: 'Start',
        onError: 'Loading error',
      },

      exit: 'setupScreens',
    },
  },
});
