package com.openframe.authz.service.sso;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.openframe.authz.service.tenant.TenantService;
import com.openframe.core.exception.AuthFlowException;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.io.Serializable;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import static com.openframe.authz.config.tenant.TenantContextFilter.TENANT_ID;
import static com.openframe.core.exception.AuthErrorCode.SSO_SESSION_INVALID;

/** Starts company sign-in using a short-lived selection that keeps workspace routing on the server. */
@Service
@RequiredArgsConstructor
public class CompanySsoLoginService {

    private static final Duration HANDLE_TTL = Duration.ofMinutes(5);
    private static final String KEY_PREFIX = "sso:company-login:";
    private static final String SESSION_FLOW = CompanySsoLoginService.class.getName() + ".flow";
    private static final Pattern HANDLE = Pattern.compile("[a-f0-9-]{36}");

    private final RedisTemplate<String, String> redisTemplate;
    private final OpenframeRedisKeyBuilder keyBuilder;
    private final ObjectMapper objectMapper;
    private final TenantService tenantService;
    private final SSOConfigService ssoConfigService;

    public String issue(String tenantId, List<String> providers) {
        String handle = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(key(handle),
                objectMapper.writeValueAsString(new Selection(tenantId, providers)), HANDLE_TTL);
        return handle;
    }

    public void start(String handle, String provider, String state, HttpServletRequest request) {
        if (!HANDLE.matcher(handle).matches()) {
            throw invalidFlow();
        }
        String stored = redisTemplate.opsForValue().getAndDelete(key(handle));
        if (stored == null) {
            throw invalidFlow();
        }
        Selection selection = objectMapper.readValue(stored, Selection.class);
        if (!selection.getProviders().contains(provider)) {
            throw invalidFlow();
        }
        requireActiveProvider(selection.getTenantId(), provider);

        clearSession(request);
        HttpSession session = request.getSession(true);
        session.setAttribute(TENANT_ID, selection.getTenantId());
        session.setAttribute(SESSION_FLOW, new Flow(selection.getTenantId(), provider, state));
    }

    public static boolean hasFlow(HttpServletRequest request) {
        return currentFlow(request.getSession(false)) != null;
    }

    public static boolean isFlowForDifferentClient(HttpServletRequest request, String tenantId, String provider) {
        Flow flow = currentFlow(request.getSession(false));
        return flow != null && (!flow.getTenantId().equals(tenantId) || !flow.getProvider().equals(provider));
    }

    public static Flow takeFlow(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        Flow flow = currentFlow(session);
        if (flow == null) {
            throw invalidFlow();
        }
        session.removeAttribute(SESSION_FLOW);
        return flow;
    }

    private static Flow currentFlow(HttpSession session) {
        return session != null && session.getAttribute(SESSION_FLOW) instanceof Flow flow ? flow : null;
    }

    public static void clearSession(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        Optional.ofNullable(request.getSession(false)).ifPresent(HttpSession::invalidate);
    }

    private void requireActiveProvider(String tenantId, String provider) {
        tenantService.findById(tenantId).filter(Tenant::isActive).orElseThrow(CompanySsoLoginService::invalidFlow);
        ssoConfigService.getSSOConfig(tenantId, provider).orElseThrow(CompanySsoLoginService::invalidFlow);
    }

    private String key(String handle) {
        return keyBuilder.globalKey(KEY_PREFIX + handle);
    }

    private static AuthFlowException invalidFlow() {
        return new AuthFlowException(SSO_SESSION_INVALID, SSO_SESSION_INVALID.getMessage());
    }

    /** Stores the workspace and providers offered by discovery until the selection is used. */
    @Getter
    private static final class Selection {
        private final String tenantId;
        private final List<String> providers;

        @JsonCreator
        private Selection(@JsonProperty("tenantId") String tenantId, @JsonProperty("providers") List<String> providers) {
            this.tenantId = tenantId;
            this.providers = providers;
        }
    }

    /** Binds the selected workspace and provider to one OAuth callback. */
    @Getter
    @RequiredArgsConstructor
    public static final class Flow implements Serializable {
        private static final long serialVersionUID = 1L;

        private final String tenantId;
        private final String provider;
        private final String state;
    }
}
