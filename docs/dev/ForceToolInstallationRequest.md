# ForceToolInstallationRequest Documentation

## Overview
The `ForceToolInstallationRequest` class is a DTO used to encapsulate requests for installing tools on specified machines.

## Core Components
- **Field**: `machineIds`
  - **Type**: `List<String>`
  - **Description**: A list of machine IDs where the tool should be installed.
- **Field**: `toolAgentId`
  - **Type**: `String`
  - **Description**: The ID of the tool agent to be installed.