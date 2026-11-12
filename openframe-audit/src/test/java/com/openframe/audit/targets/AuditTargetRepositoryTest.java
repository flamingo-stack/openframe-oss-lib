package com.openframe.audit.targets;

import com.mongodb.ReadPreference;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.command.CommandExecution;
import com.openframe.data.document.rmm.script.ScriptExecution;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.data.mongodb.core.query.Criteria.where;

@ExtendWith(MockitoExtension.class)
class AuditTargetRepositoryTest {

    private static final String EXECUTION_ID = "execution-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String RULE_ID = "rule-2";
    private static final AuditTarget<ScriptExecution> SCRIPT_EXECUTIONS =
            AuditTarget.of(AuditTargetType.EXECUTION, ScriptExecution.class, ScriptExecution::getExecutionId);
    private static final AuditTarget<CommandExecution> COMMAND_EXECUTIONS =
            AuditTarget.of(AuditTargetType.EXECUTION, CommandExecution.class, CommandExecution::getExecutionId);
    private static final AuditTarget<Machine> DEVICES =
            AuditTarget.of(AuditTargetType.DEVICE, Machine.class, Machine::getHostname).withIdField("machineId");
    private static final AuditTarget<Rule> POLICY_RULES = AuditTarget.embedded(AuditTargetType.BASE_AI_POLICY,
            Rule.class, new AuditTarget.Container<>(Policy.class, "rules", Policy::rules, Rule::id), Rule::key);

    @Mock private MongoTemplate mongoTemplate;
    @Mock private MongoConverter converter;
    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Bson> sinkCaptor;

    @InjectMocks private AuditTargetRepository repository;

    @Test
    void load_firstCandidateFound_returnsItWithoutReadingTheNext() {
        ScriptExecution execution = ScriptExecution.builder().id(EXECUTION_ID).build();
        when(mongoTemplate.findOne(query("_id", EXECUTION_ID), ScriptExecution.class)).thenReturn(execution);

        assertThat(repository.load(List.of(SCRIPT_EXECUTIONS, COMMAND_EXECUTIONS), EXECUTION_ID))
                .contains(new LoadedTarget(SCRIPT_EXECUTIONS, execution));
        verify(mongoTemplate, never()).findOne(query("_id", EXECUTION_ID), CommandExecution.class);
    }

    @Test
    void load_firstCandidateMissing_returnsTheNextCandidateFound() {
        CommandExecution execution = CommandExecution.builder().id(EXECUTION_ID).build();
        when(mongoTemplate.findOne(query("_id", EXECUTION_ID), ScriptExecution.class)).thenReturn(null);
        when(mongoTemplate.findOne(query("_id", EXECUTION_ID), CommandExecution.class)).thenReturn(execution);

        assertThat(repository.load(List.of(SCRIPT_EXECUTIONS, COMMAND_EXECUTIONS), EXECUTION_ID))
                .contains(new LoadedTarget(COMMAND_EXECUTIONS, execution));
    }

    @Test
    void load_recordMissing_returnsEmpty() {
        when(mongoTemplate.findOne(query("_id", EXECUTION_ID), ScriptExecution.class)).thenReturn(null);

        assertThat(repository.load(List.of(SCRIPT_EXECUTIONS), EXECUTION_ID)).isEmpty();
    }

    @Test
    void load_typeWithoutLoader_returnsEmpty() {
        assertThat(repository.load(List.of(), EXECUTION_ID)).isEmpty();
    }

    @Test
    void load_targetKeyedByDeclaredField_readsThatFieldOnThePrimary() {
        repository.load(List.of(DEVICES), MACHINE_ID);

        verify(mongoTemplate).findOne(queryCaptor.capture(), eq(Machine.class));
        assertThat(queryCaptor.getValue())
                .extracting(Query::getQueryObject, Query::getReadPreference)
                .containsExactly(new Document("machineId", MACHINE_ID), ReadPreference.primary());
    }

    @Test
    void load_embeddedTarget_returnsTheElementWithThatIdFromItsParent() {
        Rule wanted = new Rule(RULE_ID, "allow-ls");
        when(mongoTemplate.findOne(query("rules.id", RULE_ID), Policy.class))
                .thenReturn(new Policy(List.of(new Rule("rule-1", "block-rm"), wanted)));

        assertThat(repository.load(List.of(POLICY_RULES), RULE_ID)).contains(new LoadedTarget(POLICY_RULES, wanted));
    }

    @Test
    void load_embeddedTargetWithoutParent_returnsEmpty() {
        when(mongoTemplate.findOne(query("rules.id", RULE_ID), Policy.class)).thenReturn(null);

        assertThat(repository.load(List.of(POLICY_RULES), RULE_ID)).isEmpty();
    }

    @Test
    void storedFieldsOf_document_returnsTheFieldsTheConverterWrote() {
        Machine machine = new Machine();
        when(mongoTemplate.getConverter()).thenReturn(converter);

        Document fields = repository.storedFieldsOf(machine);

        verify(converter).write(eq(machine), sinkCaptor.capture());
        assertThat(fields).isSameAs(sinkCaptor.getValue());
    }

    private static Query query(String field, String id) {
        return Query.query(where(field).is(id));
    }

    private record Policy(List<Rule> rules) {
    }

    private record Rule(String id, String key) {
    }
}
