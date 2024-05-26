import ( Construct ) from 'constructs';
import * cdktf from 'cdktf';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { EcsCluster, EcsService, DbInstance, EcsTaskDefinition, Alb, LbListener, LbTargetGroup, SecurityGroup } from '@cdktf/provider-aws/lib/provider';
import { GlobalConfig } from  '../configs';


interface BaseStackProps {
    name: string,
    project: string,
    region: string,
}

interface DbConfigs extends BaseStackProps {
    dbAddress: string,
    dbName: string,
}

interface EcsServiceConfigs extends BaseStackProps {
    cluster: string,
    taskDefinition: string,
    targetGroup: string,
    securityGroup: string,
}

const StackProps: BaseStackProps = {
    name: "bmo-test",
    project: "bmo-iac",
    region: "us-east-2"
}

class AwsStackBase extends cdktf.TerraformStack {
//    private _provider: cdktf.TerraformProvider;
    constructor(scope: construct, id: string, baseProps: BaseStackProps) {
        super(scope, baseProps.name);
        new AwsProvider(this, 'aws', {
            region: baseProps.region
        })
        const bucketName =`${process.env.STATE_BUCKET}`

        new cdktf.S3Backend(this, {
            bucket: bucketName,
            key: `${baseProps.project}/${baseProps.name}`,
            region: `${baseProps.region}`
        });

    }

}

class EcsClusterStack extends AwsStackBase {
    public cluster: EcsCluster
    constructor(scope: construct, id: string, props: BaseStackProps) {
        super(scope, `${props.name}-ecs-cluster`)
         this.cluster = new EcsCluster(this, `${props.name}-ecs-cluster`, {
            name: "bmo-iac-cluster"
        });
    }
}

class sgStack extends AwsStackBase {
    public sg: SecurityGroup;
    constructor(scope: construct, id: string, props: BaseStackProps) {
        super(scope, `${props.name}-security-group`)
        this.sg = new SecurityGroup(this,  `${props.name}-security-group`, {
            name: sgConfigs.name,
            ingress: [
                {
                    protocol: "TCP",
                    fromPort: "80",
                    toPort: "80",
                    cidrBlocks: ["0.0.0.0/0"],
                    ipv6CidrBlocks: ["::/0"]
                }
            ]
        });
    }
}

class dbStack extends AwsStackBase {
    public db: DbInstance;
    constructor(scope: construct, id: string, props: BaseStackProps) {
        super(scope,  `${props.name}-database`)
        this.db = new DbInstance(this, `${props.name}-database`, {
            dbName: BaseStackProps.name,
            username: `${process.env.USER}`,
            password: `${process.env.PASS}`,
            enginge: "postgresql",
            publiclyAccessible: false,
            instanceClass: "db.t3.micro",
            deleteAutomatedBackups: true
        });
    }
}

class taskDefinitionStack extends AwsStackBase {
    public td: TaskDefinition;
    constructor(scope: constructor, id: string, props: BaseStackProps) {
        super(scope,  `${props.name}-task-definition`
        this.td = new EcsTaskDefinition(this, `${props.name}-task-definition`, {
            family: `${props.name}-client`,
            memory: "512",
            cpu: "256",
            networkMode: "awsvpc",
            executionRoleArn,

            containerDefinitions: Fn.jsonencode([
              {
                name: "client",
                image: "wordpress:php8.2-fpm-alpine",
                cpu: 0,
                essential: true,
                portMappings: [
                  {
                    containerPort: 80,
                    hostPort: 80,
                    protocol: "tcp",
                  },
                ],
                environment: [
                  {
                    name: "NAME",
                    value: `${props.name}-container`,
                  },
                  {
                    name: "WORDPRESS_DB_HOST",
                    value: "props.dbAddress",
                  },
                  {
                    name: "WORDPRESS_DB_USER",
                    value: `${process.env.USER}`,
                  },
                  {
                    name: " WORDPRESS_DB_PASSWORD",
                    value: `${process.env.PASS}`,
                  },
                  {
                    name: "WORDPRESS_DB_NAME",
                    value: "props.dbName",
                  }
                ]
              }
            ]),
        })
    }
}

class loadBalancerStack extends AwsStackBase {
    public lb: Alb;
    public lbl: LbListener;
    public targetGroup: LbTargetGroup;
    constructor(scope: constructor, id: string, props: BaseStackProps) {
        super(scope, `${props.name}-security-group`)

        this.lb = new Alb (this, `${props.name}-load-balancer`, {
            securityGroups: [securityGroupId],
            namePrefix: "cl-",
            loadBalancerType: "application",
            subnets: subnets.map((subnet) => subnet.id),
            idleTimeout: 60,
            ipAddressType: "dualstack",
        })

        this.targetGroup = new elb.LbTargetGroup(this,  `${props.name}-target-group`, {
          namePrefix: "cl-",
          port: 80,
          protocol: "HTTP",
          vpcId,
          deregistrationDelay: "30",
          targetType: "ip",

          healthCheck: {
            enabled: true,
            path: "/",
            healthyThreshold: 3,
            unhealthyThreshold: 3,
            timeout: 30,
            interval: 60,
            protocol: "HTTP",
          }
        })

        this.lbl = new elb.LbListener(this, `${props.name}-listener`, {
          loadBalancerArn: this.lb.arn,
          port: 80,
          protocol: "HTTP",

          defaultAction: [
            {
              type: "forward",
              targetGroupArn: this.targetGroup.arn,
            },
          ],
        })

    }
}

class EcsServiceStack extends AwsStackBase {
    constructor(scope: construct, id: string, props: BaseStackProps) {
        super(scope,`${props.name}-service` )
        new EcsService(this,`${props.name}-service`, {
            cluster: props.cluster.arn,
            taskDefinition: props.td.arn,
            desiredCount: 1,
            loadbalancer: [
                {
                    props.targetGroup.arn,
                    containerName: props.name,
                    containerPort: 80,
                },
            ],
            networkConfiguration: {
                assignpublicIp: false,
                securityGroups: [placeholder.sg.id]
            }

        })
    }
}

const App = new App();
const cluster = new EcsClusterStack(App, "ecs-cluster-stack", StackProps);
const sGroup = new sgStack(App, "sg-stack", StackProps);
const db = new dbStack(App, "db-stack", StackProps):

const DbConfig: DbConfigs = {
    dbName: db.db.address,
    dbAddress: db.db.db_name,
}

const taskDefinition = new taskDefinitionStack(App, "td-stack", DbConfig);
const lb = new loadBalancerStack(App, "lb-stack", StackProps);

const EcsConfig: EcsServiceConfigs = {
    cluster: cluster.cluster.arn,
    taskDefinition: taskDefinition.td.arn,
    targetGroup: lb.targetGroup.arn,
    securityGroup: sGroup.sg.id
}

new EcsServiceStack(App, "ecs-service-stack", EcsConfig);
App.synth();
