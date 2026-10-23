package com.openframe.management.migration;

import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;
import java.util.function.UnaryOperator;

@Slf4j
@ChangeUnit(id = "encrypt-script-secret-env-vars", order = "020", author = "openframe")
public class EncryptScriptSecretEnvVarsChangeUnit {

    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String ID_FIELD = "_id";
    private static final String ENV_VARS_FIELD = "envVars";
    private static final String CUSTOM_PARAMS_FIELD = "scriptCustomParams";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider,
                          EncryptionService encryptionService) {
        String tenantId = tenantIdProvider.getTenantId();
        UnaryOperator<String> encrypt = encryptionService::encrypt;
        int scripts = encryptScripts(mongoTemplate, tenantId, encrypt);
        int schedules = encryptSchedules(mongoTemplate, tenantId, encrypt);
        log.info("Encrypted secret env vars in {} script(s) and {} schedule(s), tenantId={}",
                scripts, schedules, tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }

    private static int encryptScripts(MongoTemplate mongoTemplate, String tenantId, UnaryOperator<String> encrypt) {
        Query query = new Query(Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(ENV_VARS_FIELD).elemMatch(plaintextSecret()));
        List<Script> scripts = mongoTemplate.find(query, Script.class);
        for (Script script : scripts) {
            List<ScriptEnvVar> sealed = ScriptEnvVar.sealAll(script.getEnvVars(), encrypt);
            mongoTemplate.updateFirst(byId(script.getId()), new Update().set(ENV_VARS_FIELD, sealed), Script.class);
        }
        return scripts.size();
    }

    private static int encryptSchedules(MongoTemplate mongoTemplate, String tenantId, UnaryOperator<String> encrypt) {
        Query query = new Query(Criteria.where(TENANT_ID_FIELD).is(tenantId)
                .and(CUSTOM_PARAMS_FIELD + "." + ENV_VARS_FIELD).elemMatch(plaintextSecret()));
        List<ScheduleScript> schedules = mongoTemplate.find(query, ScheduleScript.class);
        for (ScheduleScript schedule : schedules) {
            List<ScheduledScriptCustomParams> sealed = schedule.getScriptCustomParams().stream()
                    .map(params -> sealed(params, encrypt))
                    .toList();
            mongoTemplate.updateFirst(byId(schedule.getId()), new Update().set(CUSTOM_PARAMS_FIELD, sealed),
                    ScheduleScript.class);
        }
        return schedules.size();
    }

    private static ScheduledScriptCustomParams sealed(ScheduledScriptCustomParams params, UnaryOperator<String> encrypt) {
        List<ScriptEnvVar> envVars = params.getEnvVars();
        List<ScriptEnvVar> sealedEnvVars = ScriptEnvVar.sealAll(envVars, encrypt);
        return params.toBuilder().envVars(sealedEnvVars).build();
    }

    private static Criteria plaintextSecret() {
        return Criteria.where("secret").is(true).and("encrypted").ne(true);
    }

    private static Query byId(String id) {
        return new Query(Criteria.where(ID_FIELD).is(id));
    }
}
