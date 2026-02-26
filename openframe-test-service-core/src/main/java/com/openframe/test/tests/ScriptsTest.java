package com.openframe.test.tests;

import com.openframe.test.api.ScriptApi;
import com.openframe.test.data.dto.script.Script;
import com.openframe.test.data.generator.ScriptGenerator;
import org.junit.jupiter.api.*;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("saas")
@DisplayName("Scripts")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ScriptsTest {

    @Tag("read")
    @Test
    @DisplayName("List scripts")
    public void testListScripts() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script").isNotEmpty();
        assertThat(scripts).allSatisfy(script -> {
            assertThat(script.getId()).as("Script id should not be null").isNotNull();
            assertThat(script.getName()).as("Script name should not be empty").isNotEmpty();
            assertThat(script.getDescription()).as("Script description should not be empty").isNotEmpty();
        });
    }

    @Tag("read")
    @Test
    @DisplayName("Get script")
    public void testGetScript() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script to exist").isNotEmpty();
        Script script = scripts.getFirst();
        Script existingScript = ScriptApi.getScript(script.getId());
        assertThat(existingScript).as("Retrieved script should not be null").isNotNull();
        assertThat(existingScript.getScriptBody()).as("Script body should not be empty").isNotEmpty();
        assertThat(existingScript).as("Retrieved script should match listed script")
                .usingRecursiveComparison()
                .ignoringFields("scriptType", "scriptBody").isEqualTo(script);
    }

    @Test
    @DisplayName("Add script")
    @Order(1)
    public void testAddScript() {
        Script script = ScriptGenerator.addScriptRequest();
        String response = ScriptApi.addScript(script);
        assertThat(response).as("Add script response should match expected").isEqualTo(ScriptGenerator.addScriptResponse(script));
    }

    @Test
    @DisplayName("Edit script")
    @Order(2)
    public void testEditScript() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script to exist").isNotEmpty();
        Script script = ScriptApi.getScript(scripts.getFirst().getId());
        script.setDescription("Updated description");
        String response = ScriptApi.editScript(script);
        assertThat(response).as("Edit script response should match expected").isEqualTo(ScriptGenerator.editScriptResponse(script));
        Script updatedScript = ScriptApi.getScript(script.getId());
        assertThat(updatedScript).as("Updated script should match edited script").isEqualTo(script);
    }
}
