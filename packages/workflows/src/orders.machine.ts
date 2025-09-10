import { createMachine } from 'xstate';

export const orderMachine = createMachine({
  id: 'order',
  initial: 'created',
  states: {
    created: {
      on: {
        CONFIRM: 'confirmed',
        CANCEL: 'canceled',
      },
    },
    confirmed: {
      on: {
        FULFILL: 'fulfilled',
        CANCEL: 'canceled',
      },
    },
    fulfilled: {
      type: 'final',
    },
    canceled: {
      type: 'final',
    },
  },
});
