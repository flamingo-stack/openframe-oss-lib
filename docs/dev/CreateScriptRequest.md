# CreateScriptRequest Documentation

## Overview
The `CreateScriptRequest` class represents a request to create a new script in Tactical RMM. It includes various properties to define the script's characteristics.

## Core Responsibilities
- **Script Properties**: Contains fields for name, shell, timeout, arguments, and script body.

## Code Example
```java
@JsonProperty("name")
private String name;
@JsonProperty("script_body")
private String scriptBody;
```