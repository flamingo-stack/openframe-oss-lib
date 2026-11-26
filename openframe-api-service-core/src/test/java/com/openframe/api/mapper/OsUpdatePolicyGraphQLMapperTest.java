package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyCommand;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyTargetInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdateRestartDeadlineInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdateRolloutRuleInput;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static com.openframe.graphql.relay.NodeType.TAG;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OsUpdatePolicyGraphQLMapperTest {

    @Mock private RelayIdCodec relayIdCodec;

    @InjectMocks private OsUpdatePolicyGraphQLMapper osUpdatePolicyGraphQLMapper;

    private OsUpdatePolicyInput input;

    @BeforeEach
    void setUp() {
        input = OsUpdatePolicyInput.builder()
                .name("Kiosks")
                .target(OsUpdatePolicyTargetInput.builder()
                        .type(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("global-a")).build())
                .rolloutRules(List.of(OsUpdateRolloutRuleInput.builder()
                        .urgency(OsUpdateUrgency.QUALITY).mode(OsUpdateRolloutMode.PILOT_THEN_EVERYONE)
                        .daysAfterRelease(7).daysLaterToEveryone(14).build()))
                .restartDeadlines(List.of(OsUpdateRestartDeadlineInput.builder()
                        .urgency(OsUpdateUrgency.QUALITY).focusDays(1).softDays(5).hardDays(7).build()))
                .pilotTagId("global-pilot")
                .build();
        when(relayIdCodec.decodeAll(List.of("global-a"), TAG)).thenReturn(List.of("tag-a"));
        when(relayIdCodec.decode("global-pilot", TAG)).thenReturn("tag-pilot");
        when(relayIdCodec.encode(TAG, "tag-a")).thenReturn("global-a");
        when(relayIdCodec.encode(TAG, "tag-pilot")).thenReturn("global-pilot");
    }

    @Test
    void toCommand_input_rulesKeyedByUrgencyAndTagsUnderTheirRawIds() {
        // execution
        OsUpdatePolicyCommand command = osUpdatePolicyGraphQLMapper.toCommand(input);

        // verifications
        assertThat(command.getName()).isEqualTo("Kiosks");
        assertThat(command.getTarget().getTagIds()).containsExactly("tag-a");
        assertThat(command.getPilotTagId()).isEqualTo("tag-pilot");
        assertThat(command.getRolloutRules().get(OsUpdateUrgency.QUALITY).getDaysLaterToEveryone()).isEqualTo(14);
        assertThat(command.getRestartDeadlines().get(OsUpdateUrgency.QUALITY).getHardDays()).isEqualTo(7);
    }

    @Test
    void toCommand_urgencyListedTwice_refused() {
        // setup
        input.setRolloutRules(List.of(input.getRolloutRules().getFirst(), input.getRolloutRules().getFirst()));

        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyGraphQLMapper.toCommand(input))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("QUALITY");
    }

    @Test
    void toCommand_restartDeadlineUrgencyListedTwice_refused() {
        // setup
        input.setRestartDeadlines(
                List.of(input.getRestartDeadlines().getFirst(), input.getRestartDeadlines().getFirst()));

        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyGraphQLMapper.toCommand(input))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("restartDeadlines");
    }

    @Test
    void toCommand_inputWithoutAPilotTag_noPilotTagAndNothingDecodedForIt() {
        // setup
        input.setPilotTagId(null);

        // execution
        OsUpdatePolicyCommand command = osUpdatePolicyGraphQLMapper.toCommand(input);

        // verifications
        assertThat(command.getPilotTagId()).isNull();
    }

    @Test
    void toGraphQL_response_tagsUnderTheirGlobalIds() {
        // setup
        OsUpdatePolicyResponse response = OsUpdatePolicyResponse.builder()
                .target(OsUpdatePolicyTarget.builder()
                        .type(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("tag-a")).build())
                .pilotTagId("tag-pilot")
                .build();

        // execution
        OsUpdatePolicyResponse graphQL = osUpdatePolicyGraphQLMapper.toGraphQL(response);

        // verifications
        assertThat(graphQL.getTarget().getTagIds()).containsExactly("global-a");
        assertThat(graphQL.getPilotTagId()).isEqualTo("global-pilot");
    }
}
