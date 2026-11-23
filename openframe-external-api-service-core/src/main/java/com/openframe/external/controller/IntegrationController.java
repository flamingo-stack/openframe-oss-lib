package com.openframe.external.controller;

import com.openframe.core.exception.BaseException;
import com.openframe.core.exception.InternalException;
import com.openframe.external.web.ApiCaller;
import com.openframe.external.service.RestProxyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/tools")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Integration API", description = "Integration endpoints for external tools")
public class IntegrationController {

    private final RestProxyService restProxyService;

    @Operation(
        summary = "Proxy API request to integrated tool",
        description = """
            Proxies the request to the integrated tool's own API.

            **Fleet MDM (`fleetmdm-server`)** on multi-tenant deployments answers only `GET` requests on the \
            platform's Fleet endpoint list, scoped to your own devices; any other method or Fleet endpoint \
            answers 403 `ENDPOINT_NOT_ALLOWED`. The reads are:
            - hosts: `GET /tools/fleetmdm-server/api/v1/fleet/hosts`, `.../hosts/{id}`, \
            `.../hosts/identifier/{identifier}`, `.../hosts/{id}/software`, `.../hosts/{id}/queries`
            - policies: `.../policies`, `.../policies/{id}`, `.../policies/count`, `.../policies/{id}/hosts`
            - queries: `.../queries`, `.../queries/{id}`, `.../queries/{id}/report`, `.../queries/{id}/hosts`
            - labels: `.../labels`

            To find a device's Fleet host, call `hosts/identifier/{osUuid}` with the `osUuid` (or the \
            `serialNumber`) from `GET /api/v1/devices/{machineId}`; a hostname can match more than one host. \
            A host that is not one of your devices answers 404.
            """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "403", description = "Endpoint not allowed for this tool (ENDPOINT_NOT_ALLOWED)"),
            @ApiResponse(responseCode = "404", description = "Tool not found, or a resource the tool does not have for you"),
            @ApiResponse(responseCode = "502", description = "The tool could not be reached (TOOL_UNREACHABLE)"),
            @ApiResponse(responseCode = "504", description = "The tool did not answer in time (TOOL_TIMEOUT)")
    })
    @RequestMapping(
            value = "{toolId}/**",
            method = {
                    RequestMethod.GET,
                    RequestMethod.HEAD,
                    RequestMethod.POST,
                    RequestMethod.PUT,
                    RequestMethod.PATCH,
                    RequestMethod.DELETE,
                    RequestMethod.OPTIONS
            })
    public ResponseEntity<String> proxyApiRequest(
            @Parameter(description = "Tool identifier") @PathVariable String toolId,
            HttpServletRequest request,
            @Parameter(description = "Request body (for POST/PUT/PATCH requests)") @RequestBody(required = false) String body,
            @Parameter(hidden = true) ApiCaller caller) {
        
        String path = request.getRequestURI();
        String method = request.getMethod();
        log.info("Proxying api request for tool: {}, path: {}, method: {} - userId: {}, apiKeyId: {}", 
                toolId, path, method, caller.userId(), caller.apiKeyId());
        try {
            return restProxyService.proxyApiRequest(toolId, request, body);
        } catch (BaseException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to proxy request for tool: {}, path: {}", toolId, path, e);
            throw new InternalException("Failed to proxy the request to tool " + toolId);
        }
    }
} 