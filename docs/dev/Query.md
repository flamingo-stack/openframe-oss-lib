# Query Documentation

## Overview
`Query` represents a saved or scheduled query in the Fleet MDM context. It includes various metadata about the query and its execution statistics.

## Core Components
- **id**: The unique identifier for the query.
- **createdAt**: The timestamp when the query was created.
- **updatedAt**: The timestamp when the query was last updated.
- **name**: The name of the query.
- **description**: A brief description of the query.
- **query**: The actual query string.
- **authorId**: The ID of the author who created the query.
- **authorName**: The name of the author.
- **authorEmail**: The email of the author.
- **observerCanRun**: Indicates if observers can run the query.
- **teamId**: The ID of the team associated with the query.
- **teamName**: The name of the team.
- **platform**: The platform for which the query is intended.
- **minOsqueryVersion**: The minimum osquery version required to run the query.
- **interval**: The interval at which the query is scheduled to run.
- **automationsEnabled**: Indicates if automations are enabled for the query.
- **logging**: Logging settings for the query.
- **discardData**: Indicates if data should be discarded.
- **saved**: Indicates if the query is saved.
- **stats**: Statistics related to the query execution.