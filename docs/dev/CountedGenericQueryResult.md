# CountedGenericQueryResult Documentation

## Overview
`CountedGenericQueryResult` is a generic class that extends `GenericQueryResult`. It adds an additional field to keep track of the filtered count of results.

## Core Components
- **filteredCount**: An integer that represents the count of filtered results.

## Usage
This class is useful in scenarios where you need to return a count of results after applying certain filters, allowing clients to understand how many results were filtered out.