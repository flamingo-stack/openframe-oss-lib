package com.openframe.audit.targets;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.model.audit.AuditEntry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class ToolCredentialPartsTest {

    @Test
    void sent_everyPartAskedAndFilled_listsUsernamePasswordAndApiKey() {
        assertThat(ToolCredentialParts.sent(credentials("admin", "secret", apiKey("key-1")), _ -> true))
                .containsExactly("username", "password", "apiKey");
    }

    @ParameterizedTest
    @CsvSource({
            "username, username",
            "password, password",
            "apiKey/key, apiKey"
    })
    void sent_onlyOnePartAsked_listsOnlyThatPart(String askedPath, String listedPart) {
        assertThat(ToolCredentialParts.sent(credentials("admin", "secret", apiKey("key-1")), askedPath::equals))
                .containsExactly(listedPart);
    }

    @Test
    void sent_onlyApiKeyFilled_listsOnlyApiKey() {
        assertThat(ToolCredentialParts.sent(credentials(null, "", apiKey("key-1")), _ -> true))
                .containsExactly("apiKey");
    }

    @Test
    void sent_noApiKey_listsUsernameAndPassword() {
        assertThat(ToolCredentialParts.sent(credentials("admin", "secret", null), _ -> true))
                .containsExactly("username", "password");
    }

    @Test
    void sent_apiKeyWithBlankKey_leavesApiKeyOut() {
        assertThat(ToolCredentialParts.sent(credentials("admin", "secret", apiKey(" ")), _ -> true))
                .containsExactly("username", "password");
    }

    @Test
    void views_toolsWithAndWithoutCredentials_storesOneViewPerToolWithCredentials() {
        List<IntegratedTool> tools = List.of(
                tool("tool-1", credentials("admin", "secret", null)),
                tool("tool-2", null),
                tool("tool-3", credentials(null, null, apiKey("key-3"))));

        assertThat(ToolCredentialParts.views(tools))
                .extracting(AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactly(
                        tuple("tool-1", Map.of("fields", List.of("username", "password"))),
                        tuple("tool-3", Map.of("fields", List.of("apiKey"))));
    }

    private static IntegratedTool tool(String id, ToolCredentials credentials) {
        return IntegratedTool.builder().id(id).credentials(credentials).build();
    }

    private static ToolCredentials credentials(String username, String password, ToolApiKey apiKey) {
        ToolCredentials credentials = new ToolCredentials();
        credentials.setUsername(username);
        credentials.setPassword(password);
        credentials.setApiKey(apiKey);
        return credentials;
    }

    private static ToolApiKey apiKey(String key) {
        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setKey(key);
        return apiKey;
    }
}
