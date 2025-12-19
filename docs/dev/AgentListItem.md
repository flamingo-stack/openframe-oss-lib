# AgentListItem Documentation

## Overview
The `AgentListItem` class represents an item in the agent list for the Tactical RMM API responses. It contains essential information about the agent, including its ID, hostname, and associated client.

## Core Attributes
- **id**: Unique identifier for the agent.
- **agentId**: The agent's unique ID.
- **hostname**: The hostname of the agent.
- **site**: The site associated with the agent.
- **client**: The client associated with the agent.

## Methods
- **getId()**: Returns the ID of the agent.
- **getAgentId()**: Returns the agent ID.
- **getHostname()**: Returns the hostname.
- **getSite()**: Returns the site.
- **getClient()**: Returns the client.

## Example Usage
```java
AgentListItem agent = new AgentListItem();
agent.setId(1);
agent.setAgentId("agent-123");
agent.setHostname("host1");
agent.setSite("site1");
agent.setClient("client1");
```