# AgentRegistrationSecretRequest Documentation

## Overview
The `AgentRegistrationSecretRequest` class encapsulates the parameters required for registering an agent in the Tactical RMM system. It includes various configuration options that dictate how the agent should be installed and configured.

## Core Attributes
- **installMethod**: Method of installation for the agent.
- **client**: The client ID associated with the agent.
- **site**: The site ID where the agent will be registered.
- **expires**: Expiration time for the registration.
- **agentType**: Type of the agent being registered.
- **power**: Power settings for the agent.
- **rdp**: RDP settings for the agent.
- **ping**: Ping settings for the agent.
- **goarch**: Architecture of the agent.
- **api**: API endpoint for the agent.
- **fileName**: Name of the installation file.
- **platform**: Platform on which the agent will run.

## Methods
- **getInstallMethod()**: Returns the installation method.
- **getClient()**: Returns the client ID.
- **getSite()**: Returns the site ID.
- **getExpires()**: Returns the expiration time.
- **getAgentType()**: Returns the agent type.
- **getPower()**: Returns the power settings.
- **getRdp()**: Returns the RDP settings.
- **getPing()**: Returns the ping settings.
- **getGoarch()**: Returns the architecture.
- **getApi()**: Returns the API endpoint.
- **getFileName()**: Returns the installation file name.
- **getPlatform()**: Returns the platform.

## Example Usage
```java
AgentRegistrationSecretRequest request = new AgentRegistrationSecretRequest();
request.setInstallMethod("manual");
request.setClient(1);
request.setSite(1);
request.setExpires(3600);
request.setAgentType("default");
```