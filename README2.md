# General Outline

## 1. Assessment Overview

* **Task**: Build a REST API deployed to the cloud using a software container.

## 2. Deliverables

* Source code (exclude third-party packages, unnecessary files, data).
* 5-minute demo video (show CPU under load, Docker, EC2, API, data types, etc.).
* Response to marking criteria document (template provided).

## 3. Grading

* **Core criteria (20/30 marks)**

  * 6 tasks worth 3 marks each.
  * 1 task worth 2 marks.
* **Additional criteria (up to 10 marks)**

  * Choose up to 4 out of 5 options (2.5 marks each).
  * Must specify which were attempted.

## 4. Core Criteria

1. CPU-intensive process (\~80% load for 5 mins, e.g., video transcoding).
2. Load testing method (script or tool to trigger process, worth 2 marks).
3. At least 2 data types (structured + unstructured, excluding user login data).
4. Containerization: bundle app in Docker, push to AWS ECR.
5. Deployment: pull container from ECR, run on EC2.
6. REST API (with endpoints like create, update, delete job).
7. Basic user login with JWT (users can be hardcoded).

## 5. Additional Criteria (choose up to 4)

* Extended features of API (e.g., versioning, pagination, filtering, sorting).
* Use of external APIs (must be meaningful, not proxy).
* Additional data types/storage techniques.
* Custom CPU-intensive processing (instead of prebuilt tools like FFmpeg).
* Infrastructure as code (e.g., Docker Compose, AWS CDK, CloudFormation).
* “On request” custom option (requires prior approval).

## 6. Anti-Criteria (not to do in this task)

* Robust user management/authentication.
* Multiple processes/microservices.
* Managed databases (hold off until later assessments).
* Cloud services beyond single VM + ECR.

## 7. Application Design Guidance

* Choose a domain of interest (e.g., video, ML, physics, data analysis).
* Define use cases, CPU-intensive process, data requirements, and sources.
* Ensure application is meaningful and usable.

## 8. CPU-Intensive Processes Examples

* Video/audio transcoding.
* Image manipulation/classification.
* ML model training/inference.
* Physics simulations, data analysis pipelines.
* Large codebase compilation, testing, static analysis.
* Game servers, text processing.
* Avoid meaningless operations (e.g., calculating large factorials).

## 9. Load Testing

* Tools: Postman, curl, wget, scripts.
* Be mindful of network speed vs CPU speed.
* Can upload files in advance or use campus internet for larger uploads.

## 10. Data Requirements

* Must use structured + unstructured data.
* User identity data does not count.
* Provide user-specific distinctions (roles, permissions, ownership, settings).

## 11. External API Use (optional)

* Must add value, not proxy.
* Avoid paid/limited APIs.
* Use environment variables for API keys.
* Use public/free APIs where possible.

## 12. Technology Stack

* Stick to taught technologies (Node, Python, Docker, AWS EC2/ECR).
* Deployment: Docker container on Ubuntu 22.04 base image.
* Database: Use Dockerized images if needed.
* Local or cloud dev environment allowed.
* Must deploy final app to AWS in CAB432 account.
* Avoid unapproved languages/frameworks unless justified and approved.

## 13. Submission Process

* Submit 3 items:

  1. Source code (≤100 MB, no node\_modules/.git/data).
  2. Response to marking criteria document (follow template).
  3. Demo video (≤5 mins, screen capture, show CPU load).
* Ensure video is properly **uploaded + submitted** in Canvas.
* Include timestamps in response doc linking to evidence.
* Marking turnaround: 10–15 working days, with moderation process.

## 14. Video Guidelines

* Max 5 mins, show CPU under load for \~5 mins (trim if needed).
* High quality screen recording (no phone camera).
* Show Docker, EC2, API actions, data types, CPU load.
* Purpose: demonstrate functionality, not explain (explanations go in doc).

## 15. Final Notes

* Individual work only.
* Allowed: short snippets from web/unit, generative AI (must reference).
* Teaching team support available (pracs, Q\&A, Teams).
* Think about future use of project (resume, GitHub).

---

# ✅ To-Do List

### Step 1: Preparation

* [ ] Choose application domain + CPU-intensive process.
* [ ] Define use cases, data types, and sources.

### Step 2: Core Criteria (must complete, 20 marks)

* [ ] Implement CPU-intensive process (\~80–90% CPU load for \~5 mins).
* [ ] Create load testing method (script/tool to trigger process).
* [ ] Store at least 2 data types (structured + unstructured, exclude login).
* [ ] Containerize app with Docker.
* [ ] Push container to AWS ECR.
* [ ] Deploy container to AWS EC2 instance.
* [ ] Build REST API with endpoints (e.g., create, get, update, delete jobs).
* [ ] Add basic login system (hardcoded users, JWT auth).

### Step 3: Additional Criteria (optional, up to 10 marks)

* [ ] Select up to 4 options:

  * [ ] Robust API features (versioning, pagination, filtering, sorting).
  * [ ] Use external API (meaningful integration, not proxy).
  * [ ] Additional data types/storage approaches.
  * [ ] Custom CPU-intensive processing (bespoke algorithm).
  * [ ] Infrastructure as code (Docker Compose, CloudFormation, AWS CDK).
  * [ ] Submit special request for custom option (if relevant).

### Step 4: Avoid Anti-Criteria

* [ ] Do **not** implement full user management.
* [ ] Do **not** build multiple processes/microservices.
* [ ] Do **not** use managed DB services yet.
* [ ] Do **not** use cloud services beyond EC2 + ECR.

### Step 5: Development & Deployment

* [ ] Use approved languages/frameworks (Node, Python, etc.).
* [ ] Use Ubuntu 22.04 base image for Docker.
* [ ] Handle ports/security groups correctly in EC2.
* [ ] If using DB, deploy via official Docker image.
* [ ] Organize code modularly (routers, controllers, data access).

### Step 6: Submission Components

1. **Source Code**

   * [ ] Exclude node\_modules, .git, unnecessary files, datasets.
   * [ ] Keep under 100 MB.

2. **Response to Marking Criteria Document**

   * [ ] List all core + chosen additional criteria.
   * [ ] Provide evidence locations (source code + video timestamps).
   * [ ] Write brief explanations.

3. **Demo Video**

   * [ ] Record ≤5 min screen capture.
   * [ ] Show Docker container, EC2 deployment, API actions, data types.
   * [ ] Demonstrate CPU under \~80% load (cut/trim to fit).
   * [ ] Ensure text is readable (zoom/font size increase if needed).
   * [ ] Submit (upload + press “submit” in Canvas).

### Step 7: Academic Integrity

* [ ] Reference any copied code snippets.
* [ ] Acknowledge use of generative AI.
* [ ] Ensure work is individual.

# AWS Usage
Tagging
Tag every resource that you create with the following two tags:

qut-username: your username in the form n1234567@qut.edu.au. In some cases this tag will be added automatically.
purpose: one of
assessment 1 for resources required for your first assessment item
assessment 2 for resources required for your second assessment item
assessment 3 for resources required for your third assessment item
practical for resources used as part of practical exercises and testing
Make sure that you use exactly these strings, as our automated systems won't recognise
This does not apply to certain resources which students cannot tag.
Resources without a valid qut-username tag are subject to deletion without notice, and some permissions (eg. deleting) only allow you to interact with resources that are tagged with your own username.

Resources without a valid purpose tag are subject to deletion after notice if the tag is not updated.

Resources with purpose tag set to practical will be kept for 14 days, after which they are subject to deletion without notice.

Resources with purpose tag set to an assessment item will be kept for at least 10 days after the marks for the related assessment item have been released, unless you have an ongoing extension. After that time they are subject to deletion without notice.

If you reuse resources between assessment items, please update the purpose tag to the latest assessment item that you are using the resource for.

You can add additional tags for your own purposes. We will ignore these.

# Marking criteria

## **Core – Containerise the app**  
Dockerfile present; image built and stored in CAB432 AWS ECR.

## **Core – Deploy the container**  
Docker container deployed from ECR to EC2.

## **Core – User login**  
Login with username/password; JWT auth; meaningful user role differences.

## **Core – REST API**  
Uses full HTTP features with logical, well‑labelled endpoints.

## **Core – Data types**  
Stores at least two distinct non‑login data types with different usage needs.

## **Core – CPU intensive task**  
Has at least one relevant CPU‑heavy process triggered via API.

## **Core – CPU load testing**  
Demonstrates method to sustain >80% CPU load for ~5 minutes.

## **Additional – Extensive API features**  
Implements versioning, pagination, filtering, and sorting consistently.

## **Additional – External API(s)**  
Uses ≥1 external API as primary data source or ≥2 as secondary sources.

## **Additional – Additional types of data**  
Uses ≥3 distinct data types suited to different cloud services.

## **Additional – Custom processing**  
Includes significant custom domain‑specific processing or heavily customised existing code.

## **Additional – Infrastructure as code**  
Deploys full app to AWS (EC2 + containers) from a single IaC command.

## **Additional – Web client**  
Well‑designed browser client covering all API endpoints.

## **Additional – Upon request**  
Feature implemented to agreed standard with unit coordinator.

The easiest core feature is DNS with Route53 (2 marks). Let me guide you through the setup: Steps to configure Route53:
Get your EC2 instance public DNS/IP:
Go to AWS EC2 Console
Find your running instance
Copy the Public IPv4 DNS (e.g., ec2-xx-xx-xx-xx.compute-1.amazonaws.com)
Create CNAME record in Route53:
Go to Route53 Console
Find the hosted zone for cab432.com
Click "Create record"
Set record name: <your-name>.cab432.com (e.g., n1234567.cab432.com)
Record type: CNAME
Value: Your EC2 public DNS
TTL: 300 (5 minutes)
Click "Create records"
Test the DNS:
nslookup <your-name>.cab432.com
Do you have access to the AWS Console and know your EC2 instance details? Or would you like me to help you find this information first?