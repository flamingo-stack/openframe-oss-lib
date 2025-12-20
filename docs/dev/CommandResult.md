# CommandResult Documentation

## Overview
The `CommandResult` class encapsulates the result of a command executed on an agent. It contains various attributes that provide details about the command execution.

## Core Attributes
- `agentId`: The ID of the agent on which the command was executed.
- `stdout`: The standard output returned from the command execution.
- `timeout`: The timeout duration for the command.
- `shell`: The shell used to execute the command.
- `command`: The command string that was executed.

## Example Usage
```java
CommandResult result = new CommandResult();
result.setAgentId("agent-123");
result.setStdout("Command executed successfully.");
```

## Conclusion
The `CommandResult` class is essential for handling the outcomes of commands executed on agents, providing a structured way to access command execution details.