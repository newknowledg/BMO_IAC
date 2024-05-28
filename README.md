# AWS Wordpress ECS deployment with CDKTF
## Architecture
![ECS Microservices CDKTF-AWS](images/aws.png)
## Instructions
### This deployment uses user Access Keys.
### In the secrets and variables Actions menu, place the following key pairs
    1. AWS_ACCESS_KEY_ID: <AWS_ACCESS_KEY_ID>
    2. AWS_SECRET_ACCESS_KEY: <AWS_SECRET_ACCESS_KEY>
    3. DB_USER: <database_user_name>
    4. DB_PASS: <database_password>
    5. VPC_ID: <id_of_vpc>
    6. STATE_BUCKET: <backend_bucket_to_store_state>
    7. SUBNET: <first_subnet>
    8. SUBNET_2: <second_subnet>

### Deploy Application:
    1. Navigate to the Actions tab
    2. Select Deployment Workflow on the left panel
    3. Select Run workflow
    4. Ensure the correct branch is selected
    6. Ensure deploy is selected in the drop down menu
    7. Run workflow

### Verify deployment by:
    1. Follow the deployment at the bmo-iac-cluster on the ECS page.
    2. Copy the DNS name from the loadbalancer page and visit the site in a new tab
    
