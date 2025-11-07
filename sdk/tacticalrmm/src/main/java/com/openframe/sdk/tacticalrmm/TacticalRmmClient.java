package com.openframe.sdk.tacticalrmm;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.sdk.tacticalrmm.exception.TacticalRmmApiException;
import com.openframe.sdk.tacticalrmm.exception.TacticalRmmException;
import com.openframe.sdk.tacticalrmm.model.AgentInfo;
import com.openframe.sdk.tacticalrmm.model.AgentListItem;
import com.openframe.sdk.tacticalrmm.model.AgentRegistrationSecretRequest;
import com.openframe.sdk.tacticalrmm.model.CommandResult;
import com.openframe.sdk.tacticalrmm.model.CreateScriptRequest;
import com.openframe.sdk.tacticalrmm.model.ScriptListItem;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

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
            int timeout,
            boolean runAsUser
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

        try {
            var requestBodyNode = objectMapper.createObjectNode();
            requestBodyNode.put("shell", shell);
            requestBodyNode.put("cmd", command);
            requestBodyNode.put("timeout", timeout);
            requestBodyNode.put("run_as_user", runAsUser);
            String requestBody = objectMapper.writeValueAsString(requestBodyNode);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + RUN_COMMAND_URL + agentId + "/cmd/"))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(timeout + 15)) // Add buffer to HTTP timeout
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 401) {
                throw new TacticalRmmApiException("Authentication failed. Please check your API key.", response.statusCode(), response.body());
            } else if (response.statusCode() == 404) {
                throw new TacticalRmmApiException("Agent not found with ID: " + agentId, response.statusCode(), response.body());
            } else if (response.statusCode() != 200 && response.statusCode() != 201) {
                throw new TacticalRmmApiException("Failed to execute command", response.statusCode(), response.body());
            }

            CommandResult result = new CommandResult();
            String stdout = objectMapper.readValue(response.body(), String.class);
            result.setStdout(stdout);
            result.setAgentId(agentId);
            result.setShell(shell);
            result.setCommand(command);
            result.setTimeout(timeout);
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
        return runCommand(tacticalServerUrl, apiKey, agentId, shell, command, 30, false);
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

    /**
     * Get all agents with minimal information (detail=false)
     * @param tacticalServerUrl The Tactical RMM server URL
     * @param apiKey The API key for authentication
     * @return List of AgentListItem containing basic agent information
     */
    public List<AgentListItem> getAllAgents(String tacticalServerUrl, String apiKey) {
        // Validate parameters
        if (tacticalServerUrl == null || tacticalServerUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("Tactical server URL cannot be null or empty");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("API key cannot be null or empty");
        }

        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/agents/?detail=false"))
                    .GET()
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 401) {
                throw new TacticalRmmApiException("Authentication failed. Please check your API key.", response.statusCode(), response.body());
            } else if (response.statusCode() != 200) {
                throw new TacticalRmmApiException("Failed to get agents list", response.statusCode(), response.body());
            }

            TypeReference<List<AgentListItem>> typeRef =
                    new TypeReference<>() {
                    };
            return objectMapper.readValue(response.body(), typeRef);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to get agents list", e);
        }
    }

    /**
     * Get all scripts
     * @param tacticalServerUrl The Tactical RMM server URL
     * @param apiKey The API key for authentication
     * @return List of ScriptListItem containing script information
     */
    public List<ScriptListItem> getAllScripts(String tacticalServerUrl, String apiKey) {
        // Validate parameters
        if (tacticalServerUrl == null || tacticalServerUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("Tactical server URL cannot be null or empty");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("API key cannot be null or empty");
        }

        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/scripts/"))
                    .GET()
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 401) {
                throw new TacticalRmmApiException("Authentication failed. Please check your API key.", response.statusCode(), response.body());
            } else if (response.statusCode() != 200) {
                throw new TacticalRmmApiException("Failed to get scripts list", response.statusCode(), response.body());
            }

            TypeReference<List<ScriptListItem>> typeRef =
                    new TypeReference<>() {
                    };
            return objectMapper.readValue(response.body(), typeRef);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to get scripts list", e);
        }
    }

    /**
     * Get script information by script ID
     * @param tacticalServerUrl The Tactical RMM server URL
     * @param apiKey The API key for authentication
     * @param scriptId The ID of the script to get info for
     * @return ScriptListItem containing basic script information
     */
    public ScriptListItem getScript(String tacticalServerUrl, String apiKey, String scriptId) {
        // Validate parameters
        if (tacticalServerUrl == null || tacticalServerUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("Tactical server URL cannot be null or empty");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("API key cannot be null or empty");
        }
        if (scriptId == null || scriptId.trim().isEmpty()) {
            throw new IllegalArgumentException("Script ID cannot be null or empty");
        }

        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/scripts/" + scriptId + "/"))
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
                throw new TacticalRmmApiException("Script not found with ID: " + scriptId, response.statusCode(), response.body());
            } else if (response.statusCode() != 200) {
                throw new TacticalRmmApiException("Failed to get script info", response.statusCode(), response.body());
            }

            return objectMapper.readValue(response.body(), ScriptListItem.class);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to get script info for: " + scriptId, e);
        }
    }

    /**
     * Create a new script in Tactical RMM
     * @param tacticalServerUrl The Tactical RMM server URL
     * @param apiKey The API key for authentication
     * @param request The script creation request containing all script details
     * @return ScriptListItem containing the created script information
     */
    public ScriptListItem addScript(String tacticalServerUrl, String apiKey, CreateScriptRequest request) {
        // Validate parameters
        if (tacticalServerUrl == null || tacticalServerUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("Tactical server URL cannot be null or empty");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("API key cannot be null or empty");
        }
        if (request == null) {
            throw new IllegalArgumentException("Script request cannot be null");
        }
        if (request.getName() == null || request.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("Script name cannot be null or empty");
        }
        if (request.getShell() == null || request.getShell().trim().isEmpty()) {
            throw new IllegalArgumentException("Script shell cannot be null or empty");
        }

        try {
            String requestBody = objectMapper.writeValueAsString(request);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/scripts/"))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 401) {
                throw new TacticalRmmApiException("Authentication failed. Please check your API key.", response.statusCode(), response.body());
            } else if (response.statusCode() == 400) {
                throw new TacticalRmmApiException("Invalid script data: " + response.body(), response.statusCode(), response.body());
            } else if (response.statusCode() != 200 && response.statusCode() != 201) {
                throw new TacticalRmmApiException("Failed to create script", response.statusCode(), response.body());
            }

            return objectMapper.readValue(response.body(), ScriptListItem.class);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to create script: " + request.getName(), e);
        }
    }

    /**
     * Update an existing script in Tactical RMM
     * @param tacticalServerUrl The Tactical RMM server URL
     * @param apiKey The API key for authentication
     * @param scriptId The ID of the script to update
     * @param request The script update request containing all script details
     * @return ScriptListItem containing the updated script information
     */
    public ScriptListItem updateScript(String tacticalServerUrl, String apiKey, String scriptId, CreateScriptRequest request) {
        // Validate parameters
        if (tacticalServerUrl == null || tacticalServerUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("Tactical server URL cannot be null or empty");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("API key cannot be null or empty");
        }
        if (scriptId == null || scriptId.trim().isEmpty()) {
            throw new IllegalArgumentException("Script ID cannot be null or empty");
        }
        if (request == null) {
            throw new IllegalArgumentException("Script request cannot be null");
        }
        if (request.getName() == null || request.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("Script name cannot be null or empty");
        }
        if (request.getShell() == null || request.getShell().trim().isEmpty()) {
            throw new IllegalArgumentException("Script shell cannot be null or empty");
        }

        try {
            String requestBody = objectMapper.writeValueAsString(request);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/scripts/" + scriptId + "/"))
                    .PUT(HttpRequest.BodyPublishers.ofString(requestBody))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 401) {
                throw new TacticalRmmApiException("Authentication failed. Please check your API key.", response.statusCode(), response.body());
            } else if (response.statusCode() == 404) {
                throw new TacticalRmmApiException("Script not found with ID: " + scriptId, response.statusCode(), response.body());
            } else if (response.statusCode() == 400) {
                throw new TacticalRmmApiException("Invalid script data: " + response.body(), response.statusCode(), response.body());
            } else if (response.statusCode() != 200 && response.statusCode() != 201) {
                throw new TacticalRmmApiException("Failed to update script", response.statusCode(), response.body());
            }

            return objectMapper.readValue(response.body(), ScriptListItem.class);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to update script: " + scriptId, e);
        }
    }

}


