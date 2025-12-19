# Query Documentation

## Overview
The `Query` class represents a saved or scheduled query in the Fleet MDM system. It contains various properties that define the query's metadata and execution statistics.

## Properties
- **id**: Unique identifier for the query.
- **createdAt**: Timestamp of when the query was created.
- **updatedAt**: Timestamp of the last update to the query.
- **name**: Name of the query.
- **description**: Description of the query's purpose.
- **query**: The actual query string.
- **authorId**: ID of the author who created the query.
- **authorName**: Name of the author.
- **authorEmail**: Email of the author.
- **observerCanRun**: Indicates if observers can run the query.
- **teamId**: ID of the team associated with the query.
- **teamName**: Name of the team.
- **platform**: Platform for which the query is intended.
- **minOsqueryVersion**: Minimum osquery version required to run the query.
- **interval**: Interval at which the query is scheduled to run.
- **automationsEnabled**: Indicates if automations are enabled for the query.
- **logging**: Logging configuration for the query.
- **discardData**: Indicates if data should be discarded after execution.
- **saved**: Indicates if the query is saved.
- **stats**: Statistics related to the query execution.

## Methods
- **isScheduled()**: Checks if the query is scheduled to run based on the interval and automations settings.