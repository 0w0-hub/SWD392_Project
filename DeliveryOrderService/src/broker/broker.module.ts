import { Module } from '@nestjs/common';
import { BrokerRegistrationService } from './broker-registration.service';

@Module({ providers: [BrokerRegistrationService] })
export class BrokerModule {}
