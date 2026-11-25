package com.openframe.audit.targets;

import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.model.audit.AuditEntry;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

import static com.openframe.data.document.audit.AuditAction.TOOL_CREDENTIALS_VIEW;
import static org.springframework.util.StringUtils.hasText;

public final class ToolCredentialParts {

    private ToolCredentialParts() {
    }

    public static List<AuditEntry> views(List<IntegratedTool> tools) {
        List<AuditEntry> views = new ArrayList<>();
        for (IntegratedTool tool : tools) {
            List<String> sent = sent(tool.getCredentials(), _ -> true);
            if (!sent.isEmpty()) {
                views.add(AuditEntry.builder()
                        .action(TOOL_CREDENTIALS_VIEW)
                        .outcome(AuditOutcome.SUCCESS)
                        .targetId(tool.getId())
                        .details(Map.of("fields", sent))
                        .build());
            }
        }
        return views;
    }

    public static List<String> sent(ToolCredentials credentials, Predicate<String> asked) {
        if (credentials == null) {
            return List.of();
        }
        List<String> sent = new ArrayList<>();
        if (asked.test("username") && hasText(credentials.getUsername())) {
            sent.add("username");
        }
        if (asked.test("password") && hasText(credentials.getPassword())) {
            sent.add("password");
        }
        ToolApiKey apiKey = credentials.getApiKey();
        if (asked.test("apiKey/key") && apiKey != null && hasText(apiKey.getKey())) {
            sent.add("apiKey");
        }
        return sent;
    }
}
