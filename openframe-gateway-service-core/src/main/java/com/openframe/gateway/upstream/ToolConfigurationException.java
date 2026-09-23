package com.openframe.gateway.upstream;

/**
 * Domain exception raised when an {@link com.openframe.data.document.tool.IntegratedTool}
 * is missing required upstream configuration (e.g. no URL registered for a given
 * {@link com.openframe.data.document.tool.ToolUrlType}). Allows a centralized handler
 * to map this to a proper HTTP/GraphQL response instead of a generic error.
 */
public class ToolConfigurationException extends RuntimeException {

    public ToolConfigurationException(String message) {
        super(message);
    }
}
