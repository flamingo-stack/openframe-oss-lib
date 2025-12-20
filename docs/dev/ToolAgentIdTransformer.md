# Tool Agent ID Transformer Documentation

## Overview
The `ToolAgentIdTransformer` interface defines methods for transforming agent tool IDs into a specific format based on the tool type.

## Core Components
- **getToolType()**: Method to retrieve the tool type associated with the transformer.
- **transform(String agentToolId, boolean lastAttempt)**: Method to transform the provided agent tool ID.

## Usage
This interface is implemented by various classes to provide specific transformation logic for different tool types.