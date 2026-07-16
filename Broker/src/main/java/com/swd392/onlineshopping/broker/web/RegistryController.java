package com.swd392.onlineshopping.broker.web;

import com.swd392.onlineshopping.broker.registry.ServiceInstance;
import com.swd392.onlineshopping.broker.registry.ServiceRegistration;
import com.swd392.onlineshopping.broker.registry.ServiceRegistry;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Giao dien cua Broker. Day la hop dong ma ca 4 service trong nhom deu dung.
 */
@RestController
@RequestMapping("/registry/services")
public class RegistryController {

    private final ServiceRegistry registry;

    public RegistryController(ServiceRegistry registry) {
        this.registry = registry;
    }

    /** Service tu dang ky khi khoi dong. */
    @PostMapping
    public ResponseEntity<ServiceInstance> register(@Valid @RequestBody ServiceRegistration registration) {
        ServiceInstance instance = registry.register(registration);
        return ResponseEntity.status(HttpStatus.CREATED).body(instance);
    }

    /**
     * Service bao "toi con song".
     *
     * <p>Tra 404 neu Broker khong con biet serviceId nay (vd: Broker vua restart). Service
     * thay 404 se tu dang ky lai - day la co che tu phuc hoi cua he thong.
     */
    @PutMapping("/{serviceId}/heartbeat")
    public ResponseEntity<Void> heartbeat(@PathVariable String serviceId) {
        return registry.heartbeat(serviceId)
                ? ResponseEntity.ok().build()
                : ResponseEntity.notFound().build();
    }

    /** Service huy dang ky khi tat binh thuong. */
    @DeleteMapping("/{serviceId}")
    public ResponseEntity<Void> deregister(@PathVariable String serviceId) {
        registry.deregister(serviceId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Tra cuu.
     *
     * <ul>
     *   <li>{@code GET /registry/services} - liet ke tat ca (dung cho dashboard)</li>
     *   <li>{@code GET /registry/services?operation=placeHold} - tra cuu theo nghiep vu (yellow pages)</li>
     * </ul>
     */
    @GetMapping
    public List<ServiceInstance> list(@RequestParam(required = false) String operation) {
        return operation == null ? registry.findAll() : registry.findByOperation(operation);
    }

    /**
     * Tra cuu theo ten service (white pages) - day la thao tac client dung nhieu nhat.
     *
     * <p>Vd: {@code GET /registry/services/CustomerAccountService}
     *
     * <p>Tra ve mang rong (khong phai 404) khi khong co instance nao: "chua service nao ten
     * do dang chay" la mot cau tra loi hop le, khong phai loi.
     */
    @GetMapping("/{serviceName}")
    public List<ServiceInstance> findByName(@PathVariable String serviceName) {
        return registry.findByName(serviceName);
    }
}