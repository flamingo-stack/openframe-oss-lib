# CommandResult Documentation

## Overview
The `CommandResult` class encapsulates the result of a command executed on an agent. It includes properties for the agent ID, command output, timeout settings, and the shell used for execution.

## Properties
- **agentId**: The ID of the agent on which the command was executed.
- **stdout**: The standard output returned from the command execution.
- **timeout**: The timeout duration for the command.
- **shell**: The shell used to execute the command.
- **command**: The actual command that was executed.

## Usage
This class is primarily used in scenarios where commands are sent to agents, and their results need to be captured and processed.