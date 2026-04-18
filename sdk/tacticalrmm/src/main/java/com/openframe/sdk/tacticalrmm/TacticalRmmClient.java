package com.openframe.sdk.tacticalrmm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.sdk.tacticalrmm.exception.TacticalRmmApiException;
import com.openframe.sdk.tacticalrmm.exception.TacticalRmmException;
import com.openframe.sdk.tacticalrmm.model.AgentInfo;
import com.openframe.sdk.tacticalrmm.model.AgentListItem;
import com.openframe.sdk.tacticalrmm.model.AgentRegistrationSecretRequest;
import com.openframe.sdk.tacticalrmm.model.AutomatedTaskItem;
import com.openframe.sdk.tacticalrmm.model.CommandResult;
import com.openframe.sdk.tacticalrmm.model.CreateScriptRequest;
import com.openframe.sdk.tacticalrmm.model.ScriptListItem;
import com.openframe.sdk.tacticalrmm.model.TacticalScheduledTask;
import com.openframe.sdk.tacticalrmm.model.TacticalScript;
import com.openframe.sdk.tacticalrmm.model.CreateScriptScheduleRequest;
import com.openframe.sdk.tacticalrmm.model.UpdateScriptScheduleRequest;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;

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
        validateRunCommandParams(tacticalServerUrl, apiKey, agentId, shell, command);

        try {
            HttpRequest httpRequest = buildRunCommandRequest(tacticalServerUrl, apiKey, agentId, shell, command, timeout, runAsUser);
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            checkRunCommandResponse(response, agentId);
            return parseCommandResult(response.body(), agentId, shell, command, timeout);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to execute command on agent: " + agentId, e);
        }
    }

    /**
     * Same as {@link #runCommand} but uses non-blocking HTTP and returns a future.
     * Cancelling the future attempts to abort the in-flight request.
     */
    public CompletableFuture<CommandResult> runCommandAsync(
            String tacticalServerUrl,
            String apiKey,
            String agentId,
            String shell,
            String command,
            int timeout,
            boolean runAsUser
    ) {
        validateRunCommandParams(tacticalServerUrl, apiKey, agentId, shell, command);

        try {
            HttpRequest httpRequest = buildRunCommandRequest(tacticalServerUrl, apiKey, agentId, shell, command, timeout, runAsUser);

            return httpClient
                    .sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        checkRunCommandResponse(response, agentId);
                        try {
                            return parseCommandResult(response.body(), agentId, shell, command, timeout);
                        } catch (Exception e) {
                            throw new TacticalRmmException("Failed to parse command response for agent: " + agentId, e);
                        }
                    });
        } catch (Exception e) {
            CompletableFuture<CommandResult> failed = new CompletableFuture<>();
            failed.completeExceptionally(
                    new TacticalRmmException("Failed to execute command on agent: " + agentId, e));
            return failed;
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
     * Get automated task information by task ID
     * @param tacticalServerUrl The Tactical RMM server URL
     * @param apiKey The API key for authentication
     * @param taskId The ID of the automated task to get info for
     * @return AutomatedTaskItem containing basic task information
     */
    public AutomatedTaskItem getAutomatedTask(String tacticalServerUrl, String apiKey, String taskId) {
        // Validate parameters
        if (tacticalServerUrl == null || tacticalServerUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("Tactical server URL cannot be null or empty");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new IllegalArgumentException("API key cannot be null or empty");
        }
        if (taskId == null || taskId.trim().isEmpty()) {
            throw new IllegalArgumentException("Task ID cannot be null or empty");
        }

        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/tasks/" + taskId + "/"))
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
                throw new TacticalRmmApiException("Automated task not found with ID: " + taskId, response.statusCode(), response.body());
            } else if (response.statusCode() != 200) {
                throw new TacticalRmmApiException("Failed to get automated task info", response.statusCode(), response.body());
            }

            return objectMapper.readValue(response.body(), AutomatedTaskItem.class);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to get automated task info for: " + taskId, e);
        }
    }

    /**
     * Create a new script in Tactical RMM
     * @param tacticalServerUrl The Tactical RMM server URL
     * @param apiKey The API key for authentication
     * @param request The script creation request containing all script details
     */
    public void addScript(String tacticalServerUrl, String apiKey, CreateScriptRequest request) {
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
     */
    public void updateScript(String tacticalServerUrl, String apiKey, String scriptId, CreateScriptRequest request) {
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
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to update script: " + scriptId, e);
        }
    }

    /**
     * List all scripts with full details (includes script_body, supported_platforms, etc.)
     */
    public List<TacticalScript> getAllScriptsDetailed(String tacticalServerUrl, String apiKey) {
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
            checkSuccess(response, "list TacticalRMM scripts", null);
            TypeReference<List<TacticalScript>> typeRef = new TypeReference<>() {};
            return objectMapper.readValue(response.body(), typeRef);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to list TacticalRMM scripts", e);
        }
    }

    /**
     * Get a script by numeric ID with full details (includes script_body).
     */
    public TacticalScript getScriptDetailed(String tacticalServerUrl, String apiKey, String scriptId) {
        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/scripts/" + scriptId + "/"))
                    .GET()
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            checkSuccess(response, "get TacticalRMM script", scriptId);
            return objectMapper.readValue(response.body(), TacticalScript.class);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to get TacticalRMM script: " + scriptId, e);
        }
    }

    /**
     * Create a script and return its full details. TacticalRMM returns a confirmation string on POST,
     * so we fetch the script back by name after creation.
     */
    public TacticalScript createScriptDetailed(String tacticalServerUrl, String apiKey, CreateScriptRequest request) {
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
            checkSuccess(response, "create TacticalRMM script", null);
            return getAllScriptsDetailed(tacticalServerUrl, apiKey).stream()
                    .filter(s -> request.getName() != null && request.getName().equalsIgnoreCase(s.getName()))
                    .findFirst()
                    .orElseGet(() -> {
                        TacticalScript stub = new TacticalScript();
                        stub.setName(request.getName());
                        stub.setShell(request.getShell());
                        stub.setCategory(request.getCategory());
                        return stub;
                    });
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to create TacticalRMM script", e);
        }
    }

    /**
     * Update a script by ID and return its full updated details.
     */
    public TacticalScript updateScriptDetailed(String tacticalServerUrl, String apiKey, String scriptId, CreateScriptRequest request) {
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
            checkSuccess(response, "update TacticalRMM script", scriptId);
            return getScriptDetailed(tacticalServerUrl, apiKey, scriptId);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to update TacticalRMM script: " + scriptId, e);
        }
    }

    /**
     * List all script schedules from /script-schedules/.
     */
    public List<TacticalScheduledTask> listScriptSchedules(String tacticalServerUrl, String apiKey) {
        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/script-schedules/"))
                    .GET()
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            checkSuccess(response, "list script schedules", null);
            TypeReference<List<TacticalScheduledTask>> typeRef = new TypeReference<>() {};
            return objectMapper.readValue(response.body(), typeRef);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to list script schedules", e);
        }
    }

    /**
     * Get a script schedule by numeric ID.
     */
    public TacticalScheduledTask getScriptSchedule(String tacticalServerUrl, String apiKey, String scheduleId) {
        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/script-schedules/" + scheduleId + "/"))
                    .GET()
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            checkSuccess(response, "get script schedule", scheduleId);
            return objectMapper.readValue(response.body(), TacticalScheduledTask.class);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to get script schedule: " + scheduleId, e);
        }
    }

    /**
     * Create a script schedule and return the created entity.
     */
    public TacticalScheduledTask createScriptSchedule(
            String tacticalServerUrl,
            String apiKey,
            CreateScriptScheduleRequest request
    ) {
        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/script-schedules/"))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(request)))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            checkSuccess(response, "create script schedule", null);
            return objectMapper.readValue(response.body(), TacticalScheduledTask.class);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to create script schedule: " + request.getName(), e);
        }
    }

    /**
     * Update an existing script schedule.
     */
    public TacticalScheduledTask updateScriptSchedule(
            String tacticalServerUrl,
            String apiKey,
            int scheduleId,
            UpdateScriptScheduleRequest request
    ) {
        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/script-schedules/" + scheduleId + "/"))
                    .PUT(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(request)))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            checkSuccess(response, "update script schedule", String.valueOf(scheduleId));
            return objectMapper.readValue(response.body(), TacticalScheduledTask.class);
        } catch (TacticalRmmApiException e) {
            throw e;
        } catch (Exception e) {
            throw new TacticalRmmException("Failed to update script schedule: " + scheduleId, e);
        }
    }

    public CompletableFuture<List<TacticalScript>> getAllScriptsDetailedAsync(String tacticalServerUrl, String apiKey) {
        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(tacticalServerUrl + "/scripts/"))
                .GET()
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("X-API-KEY", apiKey)
                .timeout(Duration.ofSeconds(30))
                .build();
        return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    checkSuccess(response, "list TacticalRMM scripts", null);
                    try {
                        TypeReference<List<TacticalScript>> typeRef = new TypeReference<>() {};
                        return objectMapper.readValue(response.body(), typeRef);
                    } catch (Exception e) {
                        throw new TacticalRmmException("Failed to parse scripts list response", e);
                    }
                });
    }

    public CompletableFuture<TacticalScript> getScriptDetailedAsync(String tacticalServerUrl, String apiKey, String scriptId) {
        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(tacticalServerUrl + "/scripts/" + scriptId + "/"))
                .GET()
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("X-API-KEY", apiKey)
                .timeout(Duration.ofSeconds(30))
                .build();
        return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    checkSuccess(response, "get TacticalRMM script", scriptId);
                    try {
                        return objectMapper.readValue(response.body(), TacticalScript.class);
                    } catch (Exception e) {
                        throw new TacticalRmmException("Failed to parse script response: " + scriptId, e);
                    }
                });
    }

    public CompletableFuture<TacticalScript> createScriptDetailedAsync(String tacticalServerUrl, String apiKey, CreateScriptRequest request) {
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
            return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenCompose(response -> {
                        checkSuccess(response, "create TacticalRMM script", null);
                        return getAllScriptsDetailedAsync(tacticalServerUrl, apiKey)
                                .thenApply(scripts -> scripts.stream()
                                        .filter(s -> request.getName() != null && request.getName().equalsIgnoreCase(s.getName()))
                                        .findFirst()
                                        .orElseGet(() -> {
                                            TacticalScript stub = new TacticalScript();
                                            stub.setName(request.getName());
                                            stub.setShell(request.getShell());
                                            stub.setCategory(request.getCategory());
                                            return stub;
                                        }));
                    });
        } catch (Exception e) {
            CompletableFuture<TacticalScript> failed = new CompletableFuture<>();
            failed.completeExceptionally(new TacticalRmmException("Failed to create TacticalRMM script", e));
            return failed;
        }
    }

    public CompletableFuture<TacticalScript> updateScriptDetailedAsync(String tacticalServerUrl, String apiKey, String scriptId, CreateScriptRequest request) {
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
            return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenCompose(response -> {
                        checkSuccess(response, "update TacticalRMM script", scriptId);
                        return getScriptDetailedAsync(tacticalServerUrl, apiKey, scriptId);
                    });
        } catch (Exception e) {
            CompletableFuture<TacticalScript> failed = new CompletableFuture<>();
            failed.completeExceptionally(new TacticalRmmException("Failed to update TacticalRMM script: " + scriptId, e));
            return failed;
        }
    }

    public CompletableFuture<List<TacticalScheduledTask>> listScriptSchedulesAsync(String tacticalServerUrl, String apiKey) {
        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(tacticalServerUrl + "/script-schedules/"))
                .GET()
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("X-API-KEY", apiKey)
                .timeout(Duration.ofSeconds(30))
                .build();
        return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    checkSuccess(response, "list script schedules", null);
                    try {
                        TypeReference<List<TacticalScheduledTask>> typeRef = new TypeReference<>() {};
                        return objectMapper.readValue(response.body(), typeRef);
                    } catch (Exception e) {
                        throw new TacticalRmmException("Failed to parse script schedules response", e);
                    }
                });
    }

    public CompletableFuture<TacticalScheduledTask> getScriptScheduleAsync(String tacticalServerUrl, String apiKey, String scheduleId) {
        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(tacticalServerUrl + "/script-schedules/" + scheduleId + "/"))
                .GET()
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("X-API-KEY", apiKey)
                .timeout(Duration.ofSeconds(30))
                .build();
        return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    checkSuccess(response, "get script schedule", scheduleId);
                    try {
                        return objectMapper.readValue(response.body(), TacticalScheduledTask.class);
                    } catch (Exception e) {
                        throw new TacticalRmmException("Failed to parse script schedule response: " + scheduleId, e);
                    }
                });
    }

    public CompletableFuture<TacticalScheduledTask> createScriptScheduleAsync(String tacticalServerUrl, String apiKey, CreateScriptScheduleRequest request) {
        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/script-schedules/"))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(request)))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();
            return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        checkSuccess(response, "create script schedule", null);
                        try {
                            return objectMapper.readValue(response.body(), TacticalScheduledTask.class);
                        } catch (Exception e) {
                            throw new TacticalRmmException("Failed to parse create schedule response", e);
                        }
                    });
        } catch (Exception e) {
            CompletableFuture<TacticalScheduledTask> failed = new CompletableFuture<>();
            failed.completeExceptionally(new TacticalRmmException("Failed to create script schedule: " + request.getName(), e));
            return failed;
        }
    }

    public CompletableFuture<TacticalScheduledTask> updateScriptScheduleAsync(String tacticalServerUrl, String apiKey, int scheduleId, UpdateScriptScheduleRequest request) {
        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(tacticalServerUrl + "/script-schedules/" + scheduleId + "/"))
                    .PUT(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(request)))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("X-API-KEY", apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .build();
            return httpClient.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenApply(response -> {
                        checkSuccess(response, "update script schedule", String.valueOf(scheduleId));
                        try {
                            return objectMapper.readValue(response.body(), TacticalScheduledTask.class);
                        } catch (Exception e) {
                            throw new TacticalRmmException("Failed to parse update schedule response", e);
                        }
                    });
        } catch (Exception e) {
            CompletableFuture<TacticalScheduledTask> failed = new CompletableFuture<>();
            failed.completeExceptionally(new TacticalRmmException("Failed to update script schedule: " + scheduleId, e));
            return failed;
        }
    }

    private HttpRequest buildRunCommandRequest(
            String tacticalServerUrl, String apiKey,
            String agentId, String shell, String command,
            int timeout, boolean runAsUser
    ) throws JsonProcessingException {
        var requestBodyNode = objectMapper.createObjectNode();
        requestBodyNode.put("shell", shell);
        requestBodyNode.put("cmd", command);
        requestBodyNode.put("timeout", timeout);
        requestBodyNode.put("run_as_user", runAsUser);
        String requestBody = objectMapper.writeValueAsString(requestBodyNode);

        return HttpRequest.newBuilder()
                .uri(URI.create(tacticalServerUrl + RUN_COMMAND_URL + agentId + "/cmd/"))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("X-API-KEY", apiKey)
                .timeout(Duration.ofSeconds(timeout + 15))
                .build();
    }

    private static void checkRunCommandResponse(HttpResponse<String> response, String agentId) {
        if (response.statusCode() == 401) {
            throw new TacticalRmmApiException("Authentication failed. Please check your API key.", response.statusCode(), response.body());
        }
        if (response.statusCode() == 404) {
            throw new TacticalRmmApiException("Agent not found with ID: " + agentId, response.statusCode(), response.body());
        }
        if (response.statusCode() != 200 && response.statusCode() != 201) {
            throw new TacticalRmmApiException("Failed to execute command", response.statusCode(), response.body());
        }
    }

    private CommandResult parseCommandResult(String body, String agentId, String shell, String command, int timeout)
            throws JsonProcessingException {
        CommandResult result = new CommandResult();
        String stdout = objectMapper.readValue(body, String.class);
        result.setStdout(stdout);
        result.setAgentId(agentId);
        result.setShell(shell);
        result.setCommand(command);
        result.setTimeout(timeout);
        return result;
    }

    private void checkSuccess(HttpResponse<String> response, String action, String id) {
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            return;
        }
        String body = response.body() == null ? "" : response.body().trim();
        String detail = id != null ? " [" + id + "]" : "";
        throw new TacticalRmmApiException(action + detail + " failed with HTTP " + response.statusCode()
                + (body.isEmpty() ? "" : ": " + body), response.statusCode(), body);
    }

    private void validateRunCommandParams(
            String tacticalServerUrl,
            String apiKey,
            String agentId,
            String shell,
            String command
    ) {
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
        if (command == null || command.trim().isEmpty()) {
            throw new IllegalArgumentException("Command cannot be null or empty");
        }
    }
}


