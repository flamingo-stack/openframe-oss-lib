# LogFilterOptions Sub-Module Documentation

## Overview
The `LogFilterOptions` sub-module provides a set of filtering criteria for querying log data within the OpenFrame API. It allows users to specify various parameters to refine their search results.

## Core Functionality
- **Date Range**: Filter logs by start and end dates.
- **Event Types**: Specify types of events to include in the results.
- **Severities**: Filter logs based on severity levels.

## Key Fields
- `startDate`: LocalDate
- `endDate`: LocalDate
- `eventTypes`: List<String>
- `severities`: List<String>

## Usage
This sub-module is used in conjunction with log querying operations to narrow down results based on user-defined criteria.

---
For more information on related components, refer to the [Module 1 Documentation](module_1.md).