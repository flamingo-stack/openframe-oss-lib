package com.openframe.sdk.tacticalrmm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.sdk.tacticalrmm.exception.TacticalRmmApiException;
import com.openframe.sdk.tacticalrmm.exception.TacticalRmmException;
import com.openframe.sdk.tacticalrmm.model.AgentInfo;
import com.openframe.sdk.tacticalrmm.model.AgentRegistrationSecretRequest;
import com.openframe.sdk.tacticalrmm.model.CommandResult;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class TacticalRmmClient {

    private static final String GET_INSTALLER_URL = "/agents/installer/";
    private static final String RUN_COMMAND_URL = "/agents/";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public TacticalRmmClient() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    public String getInstallationSecret(
            String tacticalServerUrl,
            String apiKey,
            AgentRegistrationSecretRequest request
    ) {
        try {
            String requestBody = objectMapper.writeValueAsString(request);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + GET_INSTALLER_URL))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new TacticalRmmApiException("Failed to fetch agent registration secret", response.statusCode(), response.body());
            }

            String body = response.body();
            return RegistrationSecretParser.parse(body);
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to process get agent registration secret request", e);
        }
    }

    /**
     * Execute a shell command on a specific agent
     * @param tacticalServerUrl The Tactical RMM server URL
     * @param apiKey The API key for authentication
     * @param agentId The ID of the agent to execute the command on
     * @param shell The shell to use (cmd, powershell, or bash)
     * @param command The command to execute
     * @param timeout The command timeout in seconds (default 30)
     * @return CommandResult containing the command output and execution details
     */
    public CommandResult runCommand(
            String tacticalServerUrl,
            String apiKey,
            String agentId,
            String shell,
            String command,
            int timeout
    ) {
        // Validate parameters
        if (tacticalServerUrl == null || tacticalServerUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("Tactical server URL cannot be null or empty");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("API key cannot be null or empty");
        }
        if (agentId == null || agentId.trim().isEmpty()) {
            throw new IllegalArgumentException("Agent ID cannot be null or empty");
        }
        if (shell == null || shell.trim().isEmpty()) {
            throw new IllegalArgumentException("Shell cannot be null or empty");
        }
        if (!shell.equals("cmd") && !shell.equals("powershell") && !shell.equals("bash")) {
            throw new IllegalArgumentException("Shell must be one of: cmd, powershell, bash");
        }
        if (command == null || command.trim().isEmpty()) {
            throw new IllegalArgumentException("Command cannot be null or empty");
        }
        if (timeout <= 0) {
            timeout = 30; // Default timeout
        }

        try {
            // Create request body
            var requestBodyNode = objectMapper.createObjectNode();
            requestBodyNode.put("shell", shell);
            requestBodyNode.put("cmd", command);
            requestBodyNode.put("timeout", timeout);
            String requestBody = objectMapper.writeValueAsString(requestBodyNode);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + RUN_COMMAND_URL + agentId + "/cmd/"))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(timeout + 10)) // Add buffer to HTTP timeout
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 401) {
                throw new TacticalRmmApiException("Authentication failed. Please check your API key.", response.statusCode(), response.body());
            } else if (response.statusCode() == 404) {
                throw new TacticalRmmApiException("Agent not found with ID: " + agentId, response.statusCode(), response.body());
            } else if (response.statusCode() != 200 && response.statusCode() != 201) {
                throw new TacticalRmmApiException("Failed to execute command", response.statusCode(), response.body());
            }

            CommandResult result = objectMapper.readValue(response.body(), CommandResult.class);
            // Set fields that might not be in response
            if (result.getAgentId() == null) {
                result.setAgentId(agentId);
            }
            if (result.getShell() == null) {
                result.setShell(shell);
            }
            if (result.getCommand() == null) {
                result.setCommand(command);
            }
            if (result.getTimeout() == null) {
                result.setTimeout(timeout);
            }
            return result;
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to execute command on agent: " + agentId, e);
        }
    }

    /**
     * Execute a shell command on a specific agent with default timeout
     * @param tacticalServerUrl The Tactical RMM server URL
     * @param apiKey The API key for authentication
     * @param agentId The ID of the agent to execute the command on
     * @param shell The shell to use (cmd, powershell, or bash)
     * @param command The command to execute
     * @return CommandResult containing the command output and execution details
     */
    public CommandResult runCommand(
            String tacticalServerUrl,
            String apiKey,
            String agentId,
            String shell,
            String command
    ) {
        return runCommand(tacticalServerUrl, apiKey, agentId, shell, command, 30);
    }

    /**
     * Get agent information including platform and operating system details
     * @param tacticalServerUrl The Tactical RMM server URL
     * @param apiKey The API key for authentication
     * @param agentId The ID of the agent to get info for
     * @return AgentInfo containing platform and OS details
     */
    public AgentInfo getAgentInfo(String tacticalServerUrl, String apiKey, String agentId) {
        // Validate parameters
        if (tacticalServerUrl == null || tacticalServerUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("Tactical server URL cannot be null or empty");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("API key cannot be null or empty");
        }
        if (agentId == null || agentId.trim().isEmpty()) {
            throw new IllegalArgumentException("Agent ID cannot be null or empty");
        }

        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/agents/" + agentId + "/"))
                    .GET()
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 401) {
                throw new TacticalRmmApiException("Authentication failed. Please check your API key.", response.statusCode(), response.body());
            } else if (response.statusCode() == 404) {
                throw new TacticalRmmApiException("Agent not found with ID: " + agentId, response.statusCode(), response.body());
            } else if (response.statusCode() != 200) {
                throw new TacticalRmmApiException("Failed to get agent info", response.statusCode(), response.body());
            }

            return objectMapper.readValue(response.body(), AgentInfo.class);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to get agent info for: " + agentId, e);
        }
    }

}


