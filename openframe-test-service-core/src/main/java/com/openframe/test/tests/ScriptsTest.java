package com.openframe.test.tests;

import com.openframe.test.api.ScriptApi;
import com.openframe.test.data.dto.script.Script;
import com.openframe.test.data.generator.ScriptGenerator;
import com.openframe.test.tests.base.AuthorizedTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("shared")
@DisplayName("Scripts")
public class ScriptsTest extends AuthorizedTest {

    @Tag("monitor")
    @Test
    @DisplayName("List scripts")
    public void testListScripts() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script").isNotEmpty();
        assertThat(scripts).allSatisfy(script -> {
            assertThat(script.getId()).isNotNull();
            assertThat(script.getName()).isNotEmpty();
            assertThat(script.getDescription()).isNotEmpty();
        });
    }

    @Tag("monitor")
    @Test
    @DisplayName("Get script")
    public void testGetScript() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script to exist").isNotEmpty();
        Script script = scripts.getFirst();
        Script existingScript = ScriptApi.getScript(script.getId());
        assertThat(existingScript).isNotNull();
        assertThat(existingScript.getScriptBody()).isNotEmpty();
        assertThat(existingScript).usingRecursiveComparison()
                .ignoringFields("scriptType", "scriptBody").isEqualTo(script);
    }

    @Test
    @DisplayName("Add script")
    public void testAddScript() {
        Script script = ScriptGenerator.addScriptRequest();
        String response = ScriptApi.addScript(script);
        assertThat(response).isEqualTo(ScriptGenerator.addScriptResponse(script));
    }

    @Test
    @DisplayName("Edit script")
    public void testEditScript() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script to exist").isNotEmpty();
        Script script = scripts.getFirst();
        script.setDescription("Updated description");
        String response = ScriptApi.editScript(script);
        assertThat(response).isEqualTo(ScriptGenerator.editScriptResponse(script));
        Script updatedScript = ScriptApi.getScript(script.getId());
        assertThat(updatedScript).isEqualTo(script);
    }
}
