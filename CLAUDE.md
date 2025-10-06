## Overview

### Task description

You will add additional functionality to your REST API application by using a variety of cloud services. You will also make your application stateless by using cloud persistence services to store data.

### Unit Learning Outcomes assessed

* ULO1 Discuss the elastic nature of cloud technologies and business models and their application in technical, commercial and sustainability contexts.  
* ULO2 Analyse application design and implementation requirements to select suitable cloud infrastructure and software services from a range of XaaS offerings.  
* ULO4 Design and implement scalable cloud applications using industry standard languages and APIs, deployed on a public cloud infrastructure and leveraging a range of cloud services.

## What you need to do

This assessment item builds on your REST API application project from Assessment 1\. There you laid the foundations for this assessment by building the application logic around two kinds of data with different handling requirements. In this assessment you will move that data handling into cloud persistence services. You also incorporated application logic for handling multiple users. In this assessment you will make use of a cloud identity service for maintaining user identity information along with authentication and authorization.

### Core criteria (14 marks)

These criteria relate to functionality that you will extend in assessment 3\. You should consider these your top priorities.

Although there are no criteria related to deployment, it is expected that you will deploy your application on EC2 in order to access the various AWS services required by the other criteria.

Note that in this assessment the core criteria represent a smaller portion of the total grade than in the first assessment. This is because we expect that there will be a wide variety of projects, and not all of the cloud services we have studied so far will be appropriate for all projects. Hence the additional criteria, where you have the choice to attempt criteria that are most appropriate to your project, make up a larger portion than in the previous assessment.

#### Data Persistence Services (6 marks)

Your application makes relevant use of two distinct cloud data persistence services from separate categories below:

* Object storage (S3)  
* NoSQL databases (DynamoDB)  
* SQL databases (RDS)  
* Block and file storage (EBS, EFS)  
* Each category is worth 3 marks.

If you made appropriate choices for you two kinds of data in assessment 1 then these should naturally map onto two of these services. For example, a video transcoding app would probably use S3 for storing video files and either DynamoDB or RDS for metadata related to the videos.

Please note the following:

* With S3 you should not use public buckets for client access. Instead either use pre-signed URLs or handle requests for objects through your server.  
* We have a relatively small cap on the number of RDS instances. Please tag your RDS instances with key purpose set to assessment-2 and qut-username set to your full QUT username like n1234567@qut.edu.au. Teaching staff may need to delete old or improperly tagged RDS instances to make room for students using it for their assessment.

#### Authentication with Cognito (3 marks)

You will need to make relevant use of AWS Cognito for user identity management and authentication and integrate it with user functionality that you created in assessment 1\.

You must implement the following features:

* User registration, including submission of a username, email, and password  
* Email-based confirmation of registration  
* User login using a username and password, returning a JWT upon successful authentication

#### Statelessness (3 marks)

In the next assessment you will implement horizontal scaling for your application. In preparation, you need to make your application stateless, with no exclusive data storage other than in cloud persistence services:

* All persistent data for your application is held in the cloud persistence services you have set up.  
* Your application will tolerate the loss of any persistent connections (eg. websocket connection)  
* Your application state (i.e. the state of the data in the persistence services) will remain consistent if your application is stopped at any moment. Basically, your application will function correctly if restarted with a fresh container/EC2 instance.  
* If state is used (eg. a persistent connection for progress reporting) then the application will gracefully handle the loss of such state, or you have a convincing argument that a stateful design is required (eg. strict low latency or real-time requirements).

#### DNS with Route53 (2 marks)

In this assessment, you will configure a DNS record for a subdomain of cab432.com using a CNAME that points to the EC2 instance hosting your application. This setup prepares for Assessment 3, where you will use cloud services to add TLS to your public-facing server (i.e. implement HTTPS). That will require a valid TLS certificate linked to a specific domain name, which is why the subdomain configuration is necessary now. Later, you will update the DNS record to point to a service that provides TLS.

### Additional criteria (16 marks)

These should have lower priority than the core criteria above. We have provided ten options but you do not need to attempt all of them. Not all of the additional criteria are weighted the same. Keep in mind that we will stop marking once we have considered enough additional criteria to account for 16 marks, regardless of whether you have earned the full 16 marks. There is also an open-ended addition that requires approval by the unit coordinator.  
You cannot achieve more than 16 marks from these tasks. We will mark only those that you explicitly tell us to consider. You should choose the most appropriate for your application and those you will achieve the best outcome for.  
More details are given in the marking rubric. Be sure you are completing the tasks in such a way that the marking rubric is satisfied.  
It is not expected that you can respond to all additional criteria as several of them depend on the details of your application.

#### Parameter store (2 marks)

This criterion is about appropriately using Parameter store for storing relevant data for your application. For example,

* Application URL (often required by the front end for accessing your app's API)  
* External API URL or other information

#### Secrets manager (2 marks)

This criterion is about appropriately using Secrets manager for storing relevant data for your application. For example,

* External API access keys  
* Database credentials

#### In-memory caching (3 marks)

This criteria is about your appropriate use of in-memory caching for database queries or external APIs using memcached on Elasticache.  
You should have a convincing reason that the data you are caching will be accessed frequently. This does not have to be true now but it should be true in an imagined wide-scale deployment of your application.

#### Infrastructure as Code (3 marks)

For this criterion you should aim to deploy all AWS services via IaC mechanisms. That includes infrastructure as code technologies for deployment of cloud services supporting core and additional criteria. We will not assess IaC use for deploying services related to assessment 1\.  
You can use Terraform, AWS CDK, or CloudFormation. For other technologies, please ask the teaching team.  
Since using Docker compose for deploying multiple containers and IaC for EC2 were evaluated in assessment 1, this criterion only applies to services beyond these two cases. You can still use Docker compose if you like, but it will not count towards this criterion.

#### Identity management: MFA (2 marks)

For this criterion, you should make appropriate and non-trivial use of additional Cognito functionality: multi-factor authentication.  
If you want to use other Cognito functionality, please discuss with the teaching team, as not everything will be possible in our AWS environment.

#### Identity management: federated identities (2 marks)

For this criterion, you should make appropriate and non-trivial use of additional Cognito functionality: federated identities, eg. Google, Facebook, etc.  
If you want to use other Cognito functionality, please discuss with the teaching team, as not everything will be possible in our AWS environment.

#### Identity management: user groups (2 marks)

For this criterion, you should make appropriate and non-trivial use of additional Cognito functionality: user groups for organising permissions, eg. an "Admin" group that has additional permissions in your application.  
If you want to use other Cognito functionality, please discuss with the teaching team, as not everything will be possible in our AWS environment.

#### Additional persistence service (3 marks)

This criteria can gain you marks for incorporating a third and distinct type of data persistence service from the category list in the Persistence services section, above.  
There must be a compelling reason why this additional service is required/beneficial for your application; your application must take advantage of functionality that is not available in the other two services and is appropriate for the data that you are storing.

#### S3 Pre-signed URLs (2 marks)

This criteria is about using S3 pre-signed URLs for direct client upload and download.  
Where a client needs to send or receive an object stored in S3, this is done by passing a pre-signed URL to the client which then up/downloads the object directly from S3.

#### Graceful handling of persistent connections (2 marks)

If your application uses persistent connections, such as server-side-events or websockets, in an appropriate way (eg. to allow for push style notifications or progress reporting rather than less efficient polling) then you need to address how this stateful aspect of your application impacts on the overall stateless design.

* Your application should gracefully handle the loss of persistent connections. Such a loss may be due to an instance of your server being shut down as the application scales in.  
* For full marks, your application should show minimal to no degradation in functionality, for example by the client detecting the lost connection and re-establishing the connection (assuming that there is an instance of your server to serve the connection). Note that this means that whichever instance of your server serves the connection it will need to have access to whatever information is required to send to the client (eg. progress information)  
* Part marks will be awarded for graceful degradation of functionality that has some effect but does not impact on the basic functionality of the application (eg. progress reporting stops and an error is reported, but the application otherwise functions correctly)
