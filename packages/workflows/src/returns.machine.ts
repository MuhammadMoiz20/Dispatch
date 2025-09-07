import { createMachine } from 'xstate';

export const returnsMachine = createMachine({
  id: 'return',
  initial: 'initiated',
  states: {
    initiated: { on: { APPROVE: 'label_generated', REJECT: 'closed' } },
    label_generated: { on: { SCAN: 'in_transit' } },
    in_transit: { on: { DELIVERED: 'delivered' } },
    delivered: { on: { INSPECT: 'inspected' } },
    inspected: { on: { REFUND: 'refunded' } },
    refunded: { type: 'final' },
    closed: { type: 'final' }
  },
});

