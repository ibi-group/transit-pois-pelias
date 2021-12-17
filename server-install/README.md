# Server Install Scripts

The scripts here are for installing a Pelias server for transit and csv use only on an Amazon EC2 (although other Ubuntu Server instances should also work). For installing locally, please refer to the instructions in the `pelias-config` folder.

`server-install.sh` installs the dependencies needed to run `install-pelias.sh`. The scripts are split to allow Docker group changes to register in the shell.

This script was tested with Ubuntu 20.04 on an Amazon EC2 r5a.large. However, it should work with any Ubuntu/Debian-based server with minimal changes.

The script assumes this repository has been copied to the home directory of the default ubuntu user (as a folder `transit-pois-pelias`). Running the `pelias-start.sh` script will then install all needed dependencies, set them up and launch the Pelias instance and a webhook for adding content to the instance.

The server will run on port 80 (via nginx). Please note that by default there is no protection of the server. This should be done via firewall rules.


### Firewall Configuration with AWS and `pelias-stitch`
A good Security Group configuration for the ec2 instance this server runs on will only allow traffic from a datatools instance and from the `pelias-stitch` Lambda function. Unfortunately, Lambda functions don't have a consistent IP address they produce requests from, so using a firewall becomes difficult. AWS allows a firewall to allow Lambda from a security group, but requires the security group to be in the same VPC as the ec2. A Lambda function inside a VPC can not access the outside internet without a NAT Gateway.

#### The Solution
Adding a NAT Gateway to an existing VPC requires two subnets within the VPC. The first subnet should be a _public_ subnet. This subnet will contain only the NAT Gateway. The second subnet should be a _private_ subnet. This subnet will contain the Lambda functions and the EC2 instances. 

The public subnet needs to have an *Internet Gateway* attached to it (this is different from a NAT Gateway). The public subnet routing table then needs to be updated to route `0.0.0.0/0` to the Internet Gateway. 

The private subnet needs to have a *NAT Gateway* attached to it. The private subnet routing table then needs to be updated to route `0.0.0.0/0` to the NAT Gateway. 

The `pelias-stitcher` can then be configured to make requests both to IPs within its VPC and IPs in the open web (which will be routed according to the Private subnet's routing table).

Those not comfortable with adding a NAT Gateway to the VPC their EC2 instances are in can place the Lambda functions in their own VPC, and use the elastic IP of the Internet Gateway as an allowed IP for their firewall rules. Be sure to note that the `pelias-stitcher` will now need to communicate with the EC2 instance via the open web.