package com.openframe.audit;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditTargetType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.beans.factory.support.RootBeanDefinition;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.context.request.async.DeferredResult;
import org.springframework.web.context.request.async.WebAsyncTask;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import reactor.core.publisher.Mono;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Future;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Named.named;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditedMethodsCheckTest {

    private static final String BEAN = "endpoints";
    private static final String REFUSAL = "@Audited methods that would record nothing or record wrong:\n";

    @Mock private ConfigurableListableBeanFactory beanFactory;
    private AuditedMethodsCheck check;

    @BeforeEach
    void setUp() {
        check = new AuditedMethodsCheck(beanFactory, true);
    }

    @Test
    void afterSingletonsInstantiated_auditOff_checksNothing() {
        new AuditedMethodsCheck(beanFactory, false).afterSingletonsInstantiated();

        verifyNoInteractions(beanFactory);
    }

    @Test
    void afterSingletonsInstantiated_workThatFinishesLaterThreeTypeArgumentsDeep_refusesToStart() {
        onlySingleton(proxyOf(new NestedPublisherResult()));

        assertRefusal("NestedPublisherResult.archive returns work that finishes later, so the event would be written"
                + " too early");
    }

    @Test
    void afterSingletonsInstantiated_resultTypeFixedByTheBeanClass_refusesWorkThatFinishesLater() {
        onlySingleton(proxyOf(new FutureHandler()));

        assertRefusal("Handler.handle returns work that finishes later, so the event would be written too early");
    }

    @Test
    void afterSingletonsInstantiated_workThatFinishesLaterDeeperThanThreeTypeArguments_isNotLookedFor() {
        onlySingleton(proxyOf(new DeeplyNestedPublisherResult()));

        assertThatCode(check::afterSingletonsInstantiated).doesNotThrowAnyException();
    }

    @Test
    void afterSingletonsInstantiated_parameterNamedResultReadAsTheTargetId_refusesOnlyForTheName() {
        onlySingleton(proxyOf(new ParameterNamedResultReadAsTargetId()));

        assertRefusal("ParameterNamedResultReadAsTargetId.create has a parameter named result, but #result means"
                + " something else in an expression; rename the parameter");
    }

    @Test
    void afterSingletonsInstantiated_springInterfaceProxyMarkedOnItsInterface_starts() {
        onlySingleton(new ProxyFactory(new InterfaceMarkEndpoint()).getProxy());

        assertThatCode(check::afterSingletonsInstantiated).doesNotThrowAnyException();
    }

    @Test
    void afterSingletonsInstantiated_proxyOfSeveralInterfaces_refusesItsMarks() {
        Object proxy = Proxy.newProxyInstance(MarkedArchiver.class.getClassLoader(),
                new Class<?>[] {MarkedArchiver.class, Runnable.class}, (_, _, _) -> null);
        onlySingleton(proxy);

        assertThatThrownBy(check::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(".archive was compiled without parameter names, so its expressions cannot read"
                        + " them");
    }

    @Test
    void afterSingletonsInstantiated_marksReadParametersResultAndContextVariables_starts() {
        onlySingleton(proxyOf(new TicketEndpoints()));

        assertThatCode(check::afterSingletonsInstantiated).doesNotThrowAnyException();
    }

    @Test
    void afterSingletonsInstantiated_protectedAndPackagePrivateMarks_starts() {
        onlySingleton(proxyOf(new NonPublicMarks()));

        assertThatCode(check::afterSingletonsInstantiated).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @MethodSource("marksTheProxyCannotIntercept")
    void afterSingletonsInstantiated_markTheProxyCannotIntercept_refusesToStart(Object endpoint, String problem) {
        onlySingleton(proxyOf(endpoint));

        assertRefusal(problem);
    }

    static Stream<Arguments> marksTheProxyCannotIntercept() {
        return Stream.of(
                arguments(new PrivateMark(),
                        "PrivateMark.archive is private, final or static, so the aspect never sees it"),
                arguments(new FinalMark(),
                        "FinalMark.archive is private, final or static, so the aspect never sees it"),
                arguments(new StaticMark(),
                        "StaticMark.archive is private, final or static, so the aspect never sees it"));
    }

    @Test
    void afterSingletonsInstantiated_markOnlyOnTheInterfaceMethod_refusesToStart() {
        onlySingleton(proxyOf(new InterfaceMarkEndpoint()));

        assertRefusal("InterfaceMarkEndpoint.archive inherits @Audited from an interface or an overridden method,"
                + " which the aspect never sees; put it on the method itself");
    }

    @Test
    void afterSingletonsInstantiated_markedBeanNotProxied_refusesToStart() {
        onlySingleton(new ArchiveEndpoint());

        assertRefusal("ArchiveEndpoint.archive belongs to a bean that is not a Spring proxy, so its calls are never"
                + " recorded");
    }

    @ParameterizedTest
    @MethodSource("asyncResults")
    void afterSingletonsInstantiated_markedMethodReturnsWorkThatFinishesLater_refusesToStart(Object endpoint,
                                                                                             String problem) {
        onlySingleton(proxyOf(endpoint));

        assertRefusal(problem);
    }

    static Stream<Arguments> asyncResults() {
        return Stream.of(
                arguments(new FutureResult(), "FutureResult.archive returns work that finishes later,"
                        + " so the event would be written too early"),
                arguments(new CompletionStageResult(), "CompletionStageResult.archive returns work that finishes later,"
                        + " so the event would be written too early"),
                arguments(new PublisherResult(), "PublisherResult.archive returns work that finishes later,"
                        + " so the event would be written too early"),
                arguments(new CallableResult(), "CallableResult.archive returns work that finishes later,"
                        + " so the event would be written too early"),
                arguments(new DeferredResultResult(), "DeferredResultResult.archive returns work that finishes later,"
                        + " so the event would be written too early"),
                arguments(new WebAsyncTaskResult(), "WebAsyncTaskResult.archive returns work that finishes later,"
                        + " so the event would be written too early"),
                arguments(new EmitterResult(), "EmitterResult.archive returns work that finishes later,"
                        + " so the event would be written too early"),
                arguments(new StreamedBodyResult(), "StreamedBodyResult.archive returns work that finishes later,"
                        + " so the event would be written too early"));
    }

    @Test
    void afterSingletonsInstantiated_updateReadsItsTargetIdFromTheResult_refusesToStart() {
        onlySingleton(proxyOf(new ResultIdOnUpdate()));

        assertRefusal("ResultIdOnUpdate.update: targetId '#result' reads #result, so the record cannot be read before"
                + " the call and the changes of ticket.update would be lost; for an update read the id from an argument,"
                + " for an action that creates its record set compare = false");
    }

    @Test
    void afterSingletonsInstantiated_updateWithoutCompareReadsItsTargetIdFromTheResult_starts() {
        onlySingleton(proxyOf(new ResultIdOnUpdateWithoutCompare()));

        assertThatCode(check::afterSingletonsInstantiated).doesNotThrowAnyException();
    }

    @Test
    void afterSingletonsInstantiated_targetIdReadsBothTheResultAndAnArgument_refusesToStart() {
        onlySingleton(proxyOf(new MixedTargetId()));

        assertRefusal("MixedTargetId.create: targetId '#result ?: #id' reads both #result and an argument; read it"
                + " from one of them");
    }

    @Test
    void afterSingletonsInstantiated_parameterNamedLikeABuiltInVariableThatNoExpressionReads_starts() {
        onlySingleton(proxyOf(new ParameterNamedResultNotRead()));

        assertThatCode(check::afterSingletonsInstantiated).doesNotThrowAnyException();
    }


    @Test
    void afterSingletonsInstantiated_expressionsNameParametersTheMethodLacks_refusesNamingEachExpression() {
        onlySingleton(proxyOf(new UnknownParameters()));

        assertRefusal("""
                UnknownParameters.archive: '#ticketId' names #ticketId, which the method does not have
                UnknownParameters.archive: '#force' names #force, which the method does not have
                UnknownParameters.archive: '#tenant' names #tenant, which the method does not have
                UnknownParameters.archive: '#title' names #title, which the method does not have
                UnknownParameters.archive: '#organization' names #organization, which the method does not have
                UnknownParameters.archive: '#device' names #device, which the method does not have
                UnknownParameters.archive: '#tag' names #tag, which the method does not have""");
    }

    @Test
    void afterSingletonsInstantiated_noTargetTypeNamedAndTheActionHasNone_refusesToStart() {
        onlySingleton(proxyOf(new NoTargetType()));

        assertRefusal("NoTargetType.link names no target type and its action link.create has none, "
                + "so its events are never stored");
    }

    @ParameterizedTest
    @MethodSource("detailsWithoutKeyOrExpression")
    void afterSingletonsInstantiated_detailWithoutKeyOrExpression_refusesToStart(Object endpoint, String problem) {
        onlySingleton(proxyOf(endpoint));

        assertRefusal(problem);
    }

    static Stream<Arguments> detailsWithoutKeyOrExpression() {
        return Stream.of(
                arguments(new DetailWithoutKey(), "DetailWithoutKey.addTag: detail '#tagId' has no key or no"
                        + " expression, write it as key = expression"),
                arguments(new DetailWithEmptyKey(), "DetailWithEmptyKey.addTag: detail ' = #tagId' has no key or no"
                        + " expression, write it as key = expression"),
                arguments(new DetailWithoutExpression(), "DetailWithoutExpression.addTag: detail 'tagId =' has no key"
                        + " or no expression, write it as key = expression"));
    }

    @Test
    void afterSingletonsInstantiated_twoTargetTypesNamed_refusesToStart() {
        onlySingleton(proxyOf(new TwoTargetTypes()));

        assertRefusal("TwoTargetTypes.link names 2 target types, only one is used");
    }

    @ParameterizedTest
    @MethodSource("parametersNamedLikeABuiltInVariable")
    void afterSingletonsInstantiated_parameterNamedLikeABuiltInVariable_refusesToStart(Object endpoint, String problem) {
        onlySingleton(proxyOf(endpoint));

        assertRefusal(problem);
    }

    static Stream<Arguments> parametersNamedLikeABuiltInVariable() {
        return Stream.of(
                arguments(new ParameterNamedResult(), "ParameterNamedResult.archive has a parameter named result, but"
                        + " #result means something else in an expression; rename the parameter"),
                arguments(new ParameterNamedRoot(), "ParameterNamedRoot.archive has a parameter named root, but"
                        + " #root means something else in an expression; rename the parameter"));
    }

    @Test
    void afterSingletonsInstantiated_problemInAGenericInterfaceImplementation_listsItOnce() {
        onlySingleton(proxyOf(new GenericArchiveEndpoint()));

        assertRefusal("GenericArchiveEndpoint.archive: '#ticketId' names #ticketId, which the method does not have");
    }

    @Test
    void afterSingletonsInstantiated_expressionDoesNotParse_refusesToStart() {
        onlySingleton(proxyOf(new UnparsableExpression()));

        assertThatThrownBy(check::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageStartingWith(REFUSAL + "UnparsableExpression.archive: '#id +' does not parse: ");
    }

    @Test
    void afterSingletonsInstantiated_voidMethodReadsResult_refusesToStart() {
        onlySingleton(proxyOf(new VoidResult()));

        assertRefusal("VoidResult.archive: '#result' reads #result, but the method returns nothing");
    }

    @Test
    void afterSingletonsInstantiated_asyncMethod_refusesToStart() {
        onlySingleton(proxyOf(new AsyncMethod()));

        assertRefusal("AsyncMethod.archive runs on another thread (@Async), so the event loses who called it; put"
                + " @Audited on the method that calls it");
    }

    @Test
    void afterSingletonsInstantiated_methodOfAsyncClass_refusesToStart() {
        onlySingleton(proxyOf(new AsyncClass()));

        assertRefusal("AsyncClass.archive runs on another thread (@Async), so the event loses who called it; put"
                + " @Audited on the method that calls it");
    }

    @Test
    void afterSingletonsInstantiated_methodReturningVoidObjectReadsResult_refusesToStart() {
        onlySingleton(proxyOf(new VoidObjectResult()));

        assertRefusal("VoidObjectResult.archive: '#result' reads #result, but the method returns nothing");
    }

    @Test
    void afterSingletonsInstantiated_detailKeyUsedTwice_refusesToStart() {
        onlySingleton(proxyOf(new DuplicateDetailKey()));

        assertRefusal("DuplicateDetailKey.addTag: detail key 'tag' appears twice, only the last one is stored");
    }

    @Test
    void afterSingletonsInstantiated_problemsInSeveralBeans_refusesListingThemAll() {
        when(beanFactory.getBeanDefinitionNames()).thenReturn(new String[] {"archiveEndpoint", "voidResult"});
        singleton("archiveEndpoint", new ArchiveEndpoint());
        singleton("voidResult", proxyOf(new VoidResult()));

        assertRefusal("""
                ArchiveEndpoint.archive belongs to a bean that is not a Spring proxy, so its calls are never recorded
                VoidResult.archive: '#result' reads #result, but the method returns nothing""");
    }

    @ParameterizedTest
    @MethodSource("definitionsCreatedOnDemand")
    void afterSingletonsInstantiated_markedBeanCreatedOnDemand_passesItWithoutCreatingIt(BeanDefinition definition) {
        onlyBeanOfType(ArchiveEndpoint.class);
        when(beanFactory.getBeanDefinition(BEAN)).thenReturn(definition);

        check.afterSingletonsInstantiated();

        verify(beanFactory, never()).getBean(BEAN);
    }

    @ParameterizedTest
    @MethodSource("definitionsCreatedOnDemand")
    void afterSingletonsInstantiated_wrongMarkOnABeanCreatedOnDemand_refusesWithoutCreatingIt(BeanDefinition definition) {
        onlyBeanOfType(VoidResult.class);
        when(beanFactory.getBeanDefinition(BEAN)).thenReturn(definition);

        assertRefusal("VoidResult.archive: '#result' reads #result, but the method returns nothing");
        verify(beanFactory, never()).getBean(BEAN);
    }

    static Stream<Named<BeanDefinition>> definitionsCreatedOnDemand() {
        RootBeanDefinition prototype = new RootBeanDefinition(ArchiveEndpoint.class);
        prototype.setScope(BeanDefinition.SCOPE_PROTOTYPE);
        RootBeanDefinition lazy = new RootBeanDefinition(ArchiveEndpoint.class);
        lazy.setLazyInit(true);
        return Stream.of(named("prototype", prototype), named("lazy singleton", lazy));
    }

    private void assertRefusal(String problems) {
        assertThatThrownBy(check::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(REFUSAL + problems);
    }

    private void onlySingleton(Object bean) {
        when(beanFactory.getBeanDefinitionNames()).thenReturn(new String[] {BEAN});
        singleton(BEAN, bean);
    }

    private void singleton(String name, Object bean) {
        doReturn(bean.getClass()).when(beanFactory).getType(name, false);
        when(beanFactory.getBeanDefinition(name)).thenReturn(new RootBeanDefinition());
        when(beanFactory.getBean(name)).thenReturn(bean);
    }

    private void onlyBeanOfType(Class<?> type) {
        when(beanFactory.getBeanDefinitionNames()).thenReturn(new String[] {BEAN});
        doReturn(type).when(beanFactory).getType(BEAN, false);
    }

    private static Object proxyOf(Object target) {
        ProxyFactory factory = new ProxyFactory(target);
        factory.setProxyTargetClass(true);
        return factory.getProxy();
    }

    static class TicketEndpoints {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public void archive(String id) {
        }

        @Audited(action = AuditAction.TICKET_CREATE, targetId = "#result", details = "title = #title")
        public String create(String title) {
            return title;
        }

        @Audited(action = AuditAction.TICKET_ARCHIVE, details = "ticketIds = #ids.![#root.rawId(#this)]")
        public void archiveAll(List<String> ids) {
        }

        @Audited(action = AuditAction.LINK_CREATE, targetId = "#targetId", targetType = AuditTargetType.KB_ARTICLE)
        public void link(String targetId) {
        }

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public ResponseEntity<List<String>> archiveAndList(String id) {
            return null;
        }
    }

    interface Archiver<T> {

        void archive(T id);
    }

    static class GenericArchiveEndpoint implements Archiver<String> {

        @Override
        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#ticketId")
        public void archive(String id) {
        }
    }

    interface MarkedArchiver {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        void archive(String id);
    }

    static class InterfaceMarkEndpoint implements MarkedArchiver {

        @Override
        public void archive(String id) {
        }
    }

    static class ArchiveEndpoint {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public void archive(String id) {
        }
    }

    static class NonPublicMarks {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        protected void archive(String id) {
        }

        @Audited(action = AuditAction.TICKET_REOPEN, targetId = "#id")
        void reopen(String id) {
        }
    }

    static class PrivateMark {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        private void archive(String id) {
        }
    }

    static class FinalMark {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public final void archive(String id) {
        }
    }

    static class StaticMark {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public static void archive(String id) {
        }
    }

    static class FutureResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public Future<String> archive(String id) {
            return null;
        }
    }

    static class CompletionStageResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public CompletionStage<String> archive(String id) {
            return null;
        }
    }

    static class PublisherResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public Mono<String> archive(String id) {
            return Mono.empty();
        }
    }

    static class CallableResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public Callable<String> archive(String id) {
            return null;
        }
    }

    static class DeferredResultResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public DeferredResult<String> archive(String id) {
            return null;
        }
    }

    static class WebAsyncTaskResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public WebAsyncTask<String> archive(String id) {
            return null;
        }
    }

    static class EmitterResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public SseEmitter archive(String id) {
            return null;
        }
    }

    static class StreamedBodyResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public ResponseEntity<StreamingResponseBody> archive(String id) {
            return null;
        }
    }

    static class NestedPublisherResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public ResponseEntity<Optional<List<Mono<String>>>> archive(String id) {
            return null;
        }
    }

    abstract static class Handler<R> {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public R handle(String id) {
            return null;
        }
    }

    static class FutureHandler extends Handler<CompletableFuture<String>> {
    }

    static class ResultIdOnUpdate {

        @Audited(action = AuditAction.TICKET_UPDATE, targetId = "#result")
        public String update(String title) {
            return title;
        }
    }

    static class ResultIdOnUpdateWithoutCompare {

        @Audited(action = AuditAction.TICKET_UPDATE, targetId = "#result", compare = false)
        public String update(String title) {
            return title;
        }
    }

    static class MixedTargetId {

        @Audited(action = AuditAction.TICKET_CREATE, targetId = "#result ?: #id")
        public String create(String id) {
            return id;
        }
    }

    static class UnknownParameters {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#ticketId", condition = "#force",
                tenantId = "#tenant", targetName = "#title", organizationId = "#organization", deviceId = "#device",
                details = "tagId = #tag")
        public void archive(String id) {
        }
    }

    static class NoTargetType {

        @Audited(action = AuditAction.LINK_CREATE, targetId = "#id")
        public void link(String id) {
        }
    }

    static class DetailWithoutKey {

        @Audited(action = AuditAction.TICKET_TAG_ADD, targetId = "#ticketId", details = "#tagId")
        public void addTag(String ticketId, String tagId) {
        }
    }

    static class DetailWithEmptyKey {

        @Audited(action = AuditAction.TICKET_TAG_ADD, targetId = "#ticketId", details = " = #tagId")
        public void addTag(String ticketId, String tagId) {
        }
    }

    static class DetailWithoutExpression {

        @Audited(action = AuditAction.TICKET_TAG_ADD, targetId = "#ticketId", details = "tagId =")
        public void addTag(String ticketId, String tagId) {
        }
    }

    static class TwoTargetTypes {

        @Audited(action = AuditAction.LINK_CREATE, targetId = "#id",
                targetType = {AuditTargetType.KB_FOLDER, AuditTargetType.KB_ARTICLE})
        public void link(String id) {
        }
    }

    static class ParameterNamedResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id", details = "outcome = #result")
        public String archive(String id, String result) {
            return id;
        }
    }

    static class ParameterNamedRoot {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id", details = "node = #root")
        public String archive(String id, String root) {
            return id;
        }
    }

    static class ParameterNamedResultNotRead {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public String archive(String id, String result) {
            return id;
        }
    }


    static class UnparsableExpression {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id +")
        public void archive(String id) {
        }
    }

    static class VoidResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#result")
        public void archive(String id) {
        }
    }

    static class DeeplyNestedPublisherResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public ResponseEntity<Optional<List<Set<Mono<String>>>>> archive(String id) {
            return null;
        }
    }

    static class ParameterNamedResultReadAsTargetId {

        @Audited(action = AuditAction.TICKET_CREATE, targetId = "#result")
        public String create(String result) {
            return result;
        }
    }

    static class AsyncMethod {

        @Async
        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public void archive(String id) {
        }
    }

    @Async
    static class AsyncClass {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public void archive(String id) {
        }
    }

    static class VoidObjectResult {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#result")
        public Void archive(String id) {
            return null;
        }
    }

    static class DuplicateDetailKey {

        @Audited(action = AuditAction.TICKET_TAG_ADD, targetId = "#ticketId",
                details = {"tag = #tagId", "tag = #ticketId"})
        public void addTag(String ticketId, String tagId) {
        }
    }
}
