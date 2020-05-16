import { Controller, Inject, Put } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import * as Brakes from 'brakes';
import { ZBClient } from 'zeebe-node';
import { CompleteFn, Job } from 'zeebe-node';
import { ZEEBE_CONNECTION_PROVIDER, ZeebeWorker } from '@payk/nestjs-zeebe';
import { Ctx, Payload } from '@nestjs/microservices';
import * as path from 'path';

const stripeChargeUrl = 'http://localhost:8099/charge';

const brake = new Brakes(axios.post, {
  timeout: 150,
});

@Controller('/api/payment')
export class PaymentV3Controller {
  constructor(
    @Inject(ZEEBE_CONNECTION_PROVIDER) private readonly zbClient: ZBClient,
  ) {
    this.zbClient.deployWorkflow(
      path.join(__dirname, '..', '..', 'bpmn', 'paymentV3.bpmn'),
    );
  }

  @Put('/v3')
  async postPayment() {
    const traceId = uuid();
    const amount = 15;

    await this.zbClient.createWorkflowInstance('paymentV3', {
      amount,
    });

    return { status: 'pending', traceId };
  }

  @ZeebeWorker('charge-creditcard-v3')
  async chargeCreditCard(
    @Payload() job: Job,
    @Ctx() complete: CompleteFn<any>,
  ) {
    const traceId = uuid();
    const request = { amount: job.variables.amount, traceId };

    const res = await brake.exec(stripeChargeUrl, request);
    complete.success({ paymentTransactionId: res.transactionId });
  }
}
