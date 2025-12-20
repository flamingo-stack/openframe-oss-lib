# Agent Info Documentation

## Overview
The `AgentInfo` class represents the information model for agents in the Tactical RMM API responses.

## Core Attributes
- **agentId**: The unique identifier for the agent.
- **platform**: The platform on which the agent is running.
- **operatingSystem**: The operating system of the agent.
- **hostname**: The name of the host machine.

## Example
```java
AgentInfo agentInfo = new AgentInfo();
agentInfo.setAgentId("agent-001");
// Set other attributes accordingly
```