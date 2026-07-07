package com.openframe.test.tests;

import com.openframe.test.api.ScriptApi;
import com.openframe.test.data.dto.script.CreateScriptInput;
import com.openframe.test.data.dto.script.Script;
import com.openframe.test.data.dto.script.UpdateScriptInput;
import com.openframe.test.data.generator.ScriptGenerator;
import org.junit.jupiter.api.*;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("saas")
@DisplayName("Scripts")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ScriptsTest extends BaseTest {

    @Test
    @DisplayName("Add script")
    @Order(1)
    public void testAddScript() {
        CreateScriptInput input = ScriptGenerator.createScriptRequest();
        Script created = ScriptApi.createScript(input);
        assertThat(created.getId()).as("Created script should have an id").isNotNull();
        assertThat(created.getName()).as("Name should match").isEqualTo(input.getName());
        assertThat(created.getShell()).as("Shell should match").isEqualTo(input.getShell());
        assertThat(created.getScriptBody()).as("Script body should match").isEqualTo(input.getScriptBody());
        assertThat(created.getSupportedPlatforms()).as("Supported platforms should match").isEqualTo(input.getSupportedPlatforms());
    }

    @Tag("read")
    @Test
    @DisplayName("List scripts")
    @Order(2)
    public void testListScripts() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script").isNotEmpty();
        assertThat(scripts).withFailMessage("Expected to have mandatory fields").allSatisfy(script -> {
            assertThat(script.getId()).as("No Id").isNotNull();
            assertThat(script.getName()).as("No Name for " + script.getId()).isNotEmpty();
            assertThat(script.getShell()).as("No Shell for " + script.getName()).isNotEmpty();
        });
    }

    @Tag("read")
    @Test
    @DisplayName("Get script")
    @Order(3)
    public void testGetScript() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script to exist").isNotEmpty();
        Script listed = scripts.getFirst();
        Script script = ScriptApi.getScript(listed.getId());
        assertThat(script).as("Retrieved script should not be null").isNotNull();
        assertThat(script.getId()).as("Retrieved script id should match the listed script").isEqualTo(listed.getId());
        assertThat(script.getName()).as("Retrieved script name should match the listed script").isEqualTo(listed.getName());
        assertThat(script.getShell()).as("Retrieved script shell should match the listed script").isEqualTo(listed.getShell());
        assertThat(script.getScriptBody()).as("Script body should not be empty").isNotEmpty();
    }

    @Test
    @DisplayName("Edit script")
    @Order(4)
    public void testEditScript() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script to exist").isNotEmpty();
        Script script = ScriptApi.getScript(scripts.getFirst().getId());

        UpdateScriptInput input = ScriptGenerator.updateScriptRequest(script, "Updated description");
        Script updated = ScriptApi.updateScript(input);
        assertThat(updated).as("Updated script should not be null").isNotNull();
        assertThat(updated.getId()).as("Updated script id should match").isEqualTo(script.getId());
        assertThat(updated.getDescription()).as("Description should be updated").isEqualTo("Updated description");

        Script refetched = ScriptApi.getScript(script.getId());
        assertThat(refetched.getDescription()).as("Persisted description should match the update").isEqualTo("Updated description");
    }

    @Test
    @DisplayName("Archive script")
    @Order(5)
    public void testArchiveScript() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script to exist").isNotEmpty();
        Script script = ScriptApi.getScript(scripts.getFirst().getId());

        Script archived = ScriptApi.archiveScript(script.getId());
        assertThat(archived).as("Archived script should not be null").isNotNull();
        assertThat(archived.getId()).as("Archived script id should match").isEqualTo(script.getId());
        assertThat(archived.getStatus()).as("Archived script status should be ARCHIVED").isEqualTo("ARCHIVED");
    }
}
