export interface RefundInput {
  orderRef: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
}

export interface PaymentProcessor {
  executeRefund(input: RefundInput): Promise<{ processorRef: string }>;
}

/**
 * Demo processor: no network, fake reference, idempotent by key.
 */
export class MockProcessor implements PaymentProcessor {
  private readonly seen = new Map<string, string>();
  private calls = 0;

  async executeRefund(input: RefundInput): Promise<{ processorRef: string }> {
    const existing = this.seen.get(input.idempotencyKey);
    if (existing) {
      console.log(`[MockProcessor] replaying ${input.idempotencyKey} -> ${existing}`);
      return { processorRef: existing };
    }

    this.calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    const processorRef = `mock_${input.idempotencyKey}_${this.calls}`;
    this.seen.set(input.idempotencyKey, processorRef);
    console.log(
      `[MockProcessor] refunded ${input.amountCents} ${input.currency} for ${input.orderRef} -> ${processorRef}`,
    );
    return { processorRef };
  }

  /** Test helper: how many refunds actually reached the processor. */
  callCount(): number {
    return this.calls;
  }
}

let processor: PaymentProcessor = new MockProcessor();

export function getProcessor(): PaymentProcessor {
  return processor;
}

/** Test seam: swap the processor implementation. */
export function setProcessor(next: PaymentProcessor): void {
  processor = next;
}
