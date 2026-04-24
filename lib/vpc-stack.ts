import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface VpcStackProps extends cdk.StackProps {
  cidr: string;
}

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'MyVpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.cidr),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      ],
    });
  }
}