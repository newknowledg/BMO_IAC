import { Construct } from 'constructs';
import * as cdktf from 'cdktf';
import { App, Fn } from 'cdktf';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { EcsService } from '@cdktf/provider-aws/lib/ecs-service';
import { EcsTaskDefinition} from '@cdktf/provider-aws/lib/ecs-task-definition';
import { EcsCluster } from '@cdktf/provider-aws/lib/ecs-cluster';
import { Alb } from '@cdktf/provider-aws/lib/alb';
import { AlbTargetGroup } from '@cdktf/provider-aws/lib/alb-target-group';
import { AlbListener } from '@cdktf/provider-aws/lib/alb-listener';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { DbInstance } from '@cdktf/provider-aws/lib/db-instance';


interface BaseStackProps {
    name: string,
    project: string,
    region: string,
}

interface DbConfigs extends BaseStackProps {
    dbAddress: string,
    dbName: string,
}

interface LbConfigs extends BaseStackProps {
    securityGroup: string,
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
    constructor(scope: Construct, id: string, baseProps: BaseStackProps) {
        super(scope, baseProps.name );
        new AwsProvider(this, 'aws', {
            region: baseProps.region
        })
        const bucketName =`${process.env.STATE_BUCKET}`

        new cdktf.S3Backend(this, {
            bucket: bucketName,
            key: `${baseProps.project}/${id}`,
            region: `${baseProps.region}`
        });

    }

}

class EcsClusterStack extends AwsStackBase {
    public cluster: EcsCluster
    constructor(scope: Construct, id: string, props: BaseStackProps) {
        super(scope, `${props.name}-${id}`, {
            name: "bmo-test",
            project: "bmo-iac",
            region: "us-east-2"
        })
         this.cluster = new EcsCluster(this, `${props.name}-ecs-cluster`, {
            name: "bmo-iac-cluster"
        });
    }
}

class sgStack extends AwsStackBase {
    public sg: SecurityGroup;
    constructor(scope: Construct, id: string, props: BaseStackProps) {
        super(scope, `${props.name}-${id}`, {
            name: "bmo-test",
            project: "bmo-iac",
            region: "us-east-2"
        })
        this.sg = new SecurityGroup(this,  `${props.name}-security-group`, {
            name: props.name,
            ingress: [
                {
                    protocol: "TCP",
                    fromPort: 80,
                    toPort: 80,
                    cidrBlocks: ["0.0.0.0/0"],
                    ipv6CidrBlocks: ["::/0"]
                }
            ]
        });
    }
}

class dbStack extends AwsStackBase {
    public db: DbInstance;
    constructor(scope: Construct, id: string, props: BaseStackProps) {
        super(scope,  `${props.name}-${id}`, {
            name: "bmo-test",
            project: "bmo-iac",
            region: "us-east-2"
        })
        this.db = new DbInstance(this, `${props.name}-database`, {
            dbName: props.name,
            username: `${process.env.USER}`,
            password: `${process.env.PASS}`,
            engine: "postgresql",
            publiclyAccessible: false,
            instanceClass: "db.t3.micro",
            deleteAutomatedBackups: true
        });
    }
}

class taskDefinitionStack extends AwsStackBase {
    public td: EcsTaskDefinition;
    constructor(scope: Construct, id: string, props: BaseStackProps) {
        super(scope,  `${props.name}-${id}`, {
            name: "bmo-test",
            project: "bmo-iac",
            region: "us-east-2"
        })

        const executionRole = new IamRole(this, `${props.name}-execution-role`, {
          name: `${props.name}-execution-role`,
          inlinePolicy: [
            {
              name: "allow-ecr-pull",
              policy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                  {
                    Effect: "Allow",
                    Action: [
                      "ecr:GetAuthorizationToken",
                      "ecr:BatchCheckLayerAvailability",
                      "ecr:GetDownloadUrlForLayer",
                      "ecr:BatchGetImage",
                      "logs:CreateLogStream",
                      "logs:PutLogEvents",
                    ],
                    Resource: "*",
                  },
                ],
              }),
            },
          ],
          assumeRolePolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Action: "sts:AssumeRole",
                Effect: "Allow",
                Sid: "",
                Principal: {
                  Service: "ecs-tasks.amazonaws.com",
                },
              },
            ],
          }),
        });

        const taskRole = new IamRole(this, `${props.name}-task-role`, {
          name: `${props.name}-task-role`,
          inlinePolicy: [
            {
              name: "allow-logs",
              policy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                  {
                    Effect: "Allow",
                    Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
                    Resource: "*",
                  },
                ],
              }),
            },
          ],
          assumeRolePolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Action: "sts:AssumeRole",
                Effect: "Allow",
                Sid: "",
                Principal: {
                  Service: "ecs-tasks.amazonaws.com",
                },
              },
            ],
          }),
        });

        this.td = new EcsTaskDefinition(this, `${props.name}-task-definition`, {
            family: `${props.name}-client`,
            memory: "512",
            cpu: "256",
            networkMode: "awsvpc",
            executionRoleArn: executionRole.arn,
            taskRoleArn: taskRole.arn,

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
    public lbl: AlbListener;
    public targetGroup: AlbTargetGroup;
    constructor(scope: Construct, id: string, props: LbConfigs) {
        super(scope, `${props.name}-${id}`, {
            name: "bmo-test",
            project: "bmo-iac",
            region: "us-east-2"
        })

        this.lb = new Alb (this, `${props.name}-load-balancer`, {
            securityGroups: [props.securityGroup],
            namePrefix: "cl-",
            loadBalancerType: "application",
            //subnets: "0.0.0.0/0",
            idleTimeout: 60,
            ipAddressType: "dualstack",
        })

        this.targetGroup = new AlbTargetGroup(this,  `${props.name}-target-group`, {
          namePrefix: "cl-",
          port: 80,
          protocol: "HTTP",
          //vpcId,
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

        this.lbl = new AlbListener(this, `${props.name}-listener`, {
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
    constructor(scope: Construct, id: string, props: EcsServiceConfigs) {
        super(scope,`${props.name}-${id}` , {
            name: "bmo-test",
            project: "bmo-iac",
            region: "us-east-2"
        })
        new EcsService(this,`${props.name}-service`, {
            cluster: props.cluster,
            taskDefinition: props.taskDefinition,
            desiredCount: 1,
            launchType: "FARGATE",
            loadBalancer: [
                {
                    targetGroupArn: props.targetGroup.arn,
                    containerName: props.name,
                    containerPort: 80,
                },
            ],
            EcsNetworkConfiguration: {
                assignPublicIp: false,
                subnets: ["0.0.0.0/0"],
                securityGroups: [props.securityGroup]
            }

        })
    }
}

const app = new App();
const cluster = new EcsClusterStack(app, "ecs-cluster-stack", StackProps);
const sGroup = new sgStack(app, "sg-stack", StackProps);
const db = new dbStack(app, "db-stack", StackProps);

const DbConfig: DbConfigs = {
    name: "bmo-test",
    project: "bmo-iac",
    region: "us-east-2",
    dbName: db.db.address,
    dbAddress: db.db.dbName,
}

const LbConfig: LbConfigs = {
    name: "bmo-test",
    project: "bmo-iac",
    region: "us-east-2",
    securityGroup: sGroup.sg.id,
}

const taskDefinition = new taskDefinitionStack(app, "td-stack", DbConfig);
const lb = new loadBalancerStack(app, "lb-stack", LbConfig);

const EcsConfig: EcsServiceConfigs = {
    name: "bmo-test",
    project: "bmo-iac",
    region: "us-east-2",
    cluster: cluster.cluster.arn,
    taskDefinition: taskDefinition.td.arn,
    targetGroup: lb.targetGroup.arn,
    securityGroup: sGroup.sg.id
}

new EcsServiceStack(app, "ecs-service-stack", EcsConfig);
app.synth();
