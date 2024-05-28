# AWS Wordpress ECS deployment with CDKTF
## Architecture
![ECS Microservices CDKTF-AWS](images/aws.png)
## Instructions
This deployment uses user Access Keys.
 1. In the secrest and variables Actions menu, place the following key pairs
    a. AWS_ACCESS_KEY_ID: <AWS_ACCESS_KEY_ID>
    b. AWS_SECRET_ACCESS_KEY: <AWS_SECRET_ACCESS_KEY>
    c. DB_USER: <database user name>
    d. DB_PASS: <database password>
    e. VPC_ID: <id of vpc>
    f. STATE_BUCKET: <backend bucket to store state>
    g. SUBNET: <first subnet>
    h. SUBNET_2: <second subnet>

2. Verify deployment by:
    a. Follow the deployment at the bmo-iac-cluster on the ECS page.
    a. Copy the DNS name from the loadbalancer page and visit the site in a new tab
    
