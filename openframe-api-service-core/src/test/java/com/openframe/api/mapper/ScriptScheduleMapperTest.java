package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.schedule.CreateScriptScheduleInput;
import com.openframe.api.dto.rmm.schedule.ScheduledScriptCustomParamsInput;
import com.openframe.api.dto.rmm.schedule.UpdateScriptScheduleInput;
import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import org.assertj.core.groups.Tuple;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptScheduleMapperTest {

    private static final String SCRIPT_ID = "6a8b9460e0e12b4188881ae2";

    private final ScriptScheduleMapper mapper = new ScriptScheduleMapper();

    @Test
    @DisplayName("toEntity (create): secret override with value=null resolves from the script's own env vars — first-time customization keeps the script's stored secret")
    void toEntity_createWithSecretNull_fallsBackToScriptDefault() {
        CreateScriptScheduleInput input = createInput(customParams(SCRIPT_ID, List.of("--custom"), List.of(
                ScriptEnvVarInput.builder().name("PLAIN").value("staging").secret(false).build(),
                ScriptEnvVarInput.builder().name("TOKEN").value(null).secret(true).build())));

        Map<String, List<ScriptEnvVar>> scriptDefaults = Map.of(
                SCRIPT_ID, List.of(
                        ScriptEnvVar.builder().name("PLAIN").value("prod").secret(false).build(),
                        ScriptEnvVar.builder().name("TOKEN").value("script-secret").secret(true).build()));

        ScheduleScript entity = mapper.toEntity("tenant-1", input, scriptDefaults);

        assertThat(entity.getScriptCustomParams())
                .singleElement()
                .satisfies(p -> {
                    assertThat(p.getScriptId()).isEqualTo(SCRIPT_ID);
                    assertThat(p.getArgs()).containsExactly("--custom");
                    assertThat(p.getEnvVars())
                            .extracting(ScriptEnvVar::getName, ScriptEnvVar::getValue, ScriptEnvVar::isSecret)
                            .containsExactly(
                                    Tuple.tuple("PLAIN", "staging", false),
                                    Tuple.tuple("TOKEN", "script-secret", true));
                });
    }

    @Test
    @DisplayName("updateEntity: secret override with value=null and a prior stored override for that scriptId keeps the previously customized secret — not the script default")
    void updateEntity_withStoredOverride_keepsStoredSecret() {
        ScheduleScript existing = scheduleWithOverride(SCRIPT_ID, List.of(
                ScriptEnvVar.builder().name("TOKEN").value("stored-override-secret").secret(true).build()));

        UpdateScriptScheduleInput input = updateInput(customParams(SCRIPT_ID, List.of("--custom"), List.of(
                ScriptEnvVarInput.builder().name("PLAIN").value("staging").secret(false).build(),
                ScriptEnvVarInput.builder().name("TOKEN").value(null).secret(true).build())));

        Map<String, List<ScriptEnvVar>> scriptDefaults = Map.of(
                SCRIPT_ID, List.of(
                        ScriptEnvVar.builder().name("PLAIN").value("prod").secret(false).build(),
                        ScriptEnvVar.builder().name("TOKEN").value("script-secret").secret(true).build()));

        mapper.updateEntity(existing, input, scriptDefaults);

        assertThat(existing.getScriptCustomParams().get(0).getEnvVars())
                .extracting(ScriptEnvVar::getName, ScriptEnvVar::getValue, ScriptEnvVar::isSecret)
                .containsExactly(
                        Tuple.tuple("PLAIN", "staging", false),
                        // stored override wins over script default — the "customized secret" invariant.
                        Tuple.tuple("TOKEN", "stored-override-secret", true));
    }

    @Test
    @DisplayName("updateEntity: secret override with value=null and no stored override for this scriptId falls through to script default — first-time customization mid-edit")
    void updateEntity_noStoredOverrideForScriptId_fallsBackToScriptDefault() {
        // Existing schedule has an override for a DIFFERENT script — none for SCRIPT_ID yet.
        ScheduleScript existing = scheduleWithOverride("other-script-id", List.of(
                ScriptEnvVar.builder().name("OTHER").value("v").secret(false).build()));

        UpdateScriptScheduleInput input = updateInput(customParams(SCRIPT_ID, List.of("--custom"), List.of(
                ScriptEnvVarInput.builder().name("TOKEN").value(null).secret(true).build())));

        Map<String, List<ScriptEnvVar>> scriptDefaults = Map.of(
                SCRIPT_ID, List.of(
                        ScriptEnvVar.builder().name("TOKEN").value("script-secret").secret(true).build()));

        mapper.updateEntity(existing, input, scriptDefaults);

        assertThat(existing.getScriptCustomParams())
                .singleElement()
                .satisfies(p -> assertThat(p.getEnvVars())
                        .singleElement()
                        .extracting(ScriptEnvVar::getValue)
                        .isEqualTo("script-secret"));
    }

    @Test
    @DisplayName("updateEntity: NON-secret override with value=null is rejected — plain env vars must always carry a value")
    void updateEntity_nonSecretNullValue_rejected() {
        ScheduleScript existing = scheduleWithOverride(SCRIPT_ID, List.of());
        UpdateScriptScheduleInput input = updateInput(customParams(SCRIPT_ID, null, List.of(
                ScriptEnvVarInput.builder().name("PLAIN").value(null).secret(false).build())));

        assertThatThrownBy(() -> mapper.updateEntity(existing, input, Map.of(SCRIPT_ID, List.of())))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("PLAIN");
    }

    @Test
    @DisplayName("updateEntity: secret override with value=null and no fallback (neither stored nor script default) is rejected — nothing to keep")
    void updateEntity_secretNullValueAndNoFallback_rejected() {
        ScheduleScript existing = scheduleWithOverride(SCRIPT_ID, List.of());
        UpdateScriptScheduleInput input = updateInput(customParams(SCRIPT_ID, null, List.of(
                ScriptEnvVarInput.builder().name("TOKEN").value(null).secret(true).build())));

        assertThatThrownBy(() -> mapper.updateEntity(existing, input, Map.of(SCRIPT_ID, List.of())))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("TOKEN");
    }

    @Test
    @DisplayName("updateEntity: an override with envVars=null means 'inherit script defaults' — no resolution runs, secret in the script never gets touched")
    void updateEntity_envVarsNullMeansInherit() {
        ScheduleScript existing = scheduleWithOverride(SCRIPT_ID, List.of(
                ScriptEnvVar.builder().name("TOKEN").value("stored").secret(true).build()));

        UpdateScriptScheduleInput input = updateInput(customParams(SCRIPT_ID, List.of("--only-args"), null));

        mapper.updateEntity(existing, input, Map.of());

        assertThat(existing.getScriptCustomParams())
                .singleElement()
                .satisfies(p -> {
                    assertThat(p.getArgs()).containsExactly("--only-args");
                    assertThat(p.getEnvVars()).isNull();
                });
    }

    private static CreateScriptScheduleInput createInput(ScheduledScriptCustomParamsInput params) {
        CreateScriptScheduleInput input = new CreateScriptScheduleInput();
        input.setName("Nightly Deploy");
        input.setScriptIds(List.of(params.getScriptId()));
        input.setScriptCustomParams(List.of(params));
        return input;
    }

    private static UpdateScriptScheduleInput updateInput(ScheduledScriptCustomParamsInput params) {
        UpdateScriptScheduleInput input = new UpdateScriptScheduleInput();
        input.setId("65f4a8000000000000000001");
        input.setName("Nightly Deploy");
        input.setScriptIds(List.of(params.getScriptId()));
        input.setScriptCustomParams(List.of(params));
        return input;
    }

    private static ScheduledScriptCustomParamsInput customParams(String scriptId, List<String> args,
                                                                 List<ScriptEnvVarInput> envVars) {
        ScheduledScriptCustomParamsInput input = new ScheduledScriptCustomParamsInput();
        input.setScriptId(scriptId);
        input.setArgs(args);
        input.setEnvVars(envVars);
        return input;
    }

    private static ScheduleScript scheduleWithOverride(String scriptId, List<ScriptEnvVar> envVars) {
        return ScheduleScript.builder()
                .id("65f4a8000000000000000001")
                .tenantId("tenant-1")
                .name("Nightly Deploy")
                .scriptIds(List.of(scriptId))
                .scriptCustomParams(List.of(
                        ScheduledScriptCustomParams.builder()
                                .scriptId(scriptId)
                                .envVars(envVars)
                                .build()))
                .build();
    }
}
