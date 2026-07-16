package com.example.BrokerNCoordinator.Controller;

import com.example.BrokerNCoordinator.DTO.Invoice;
import com.example.BrokerNCoordinator.DataModel.CustomerAccount;
import com.example.BrokerNCoordinator.DataModel.DeliveryOrder;
import com.example.BrokerNCoordinator.Service.Interface.ICatalogService;
import com.example.BrokerNCoordinator.Service.Interface.ICustomerAccountService;
import com.example.BrokerNCoordinator.Service.Interface.IDeliveryOrderService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/customers/")
public class CustomerCoordinator {

    private final ICatalogService catalogService;
    private final IDeliveryOrderService deliveryOrderService;
    private final ICustomerAccountService customerAccountService;

    public CustomerCoordinator(ICatalogService catalogService, IDeliveryOrderService deliveryOrderService, ICustomerAccountService customerAccountService) {
        this.catalogService = catalogService;
        this.deliveryOrderService = deliveryOrderService;
        this.customerAccountService = customerAccountService;
    }
    //Browe Catalog
    @GetMapping()
    public Object RequestCatalog(Object catalogType){
        Object answear = catalogService.requestCatalog(catalogType);
        return answear;
    }

    @GetMapping()
    public Object CatalogSelection(Object itemId){
        return catalogService.requestSelection(itemId);
    }

    // Make Order Request
    @GetMapping()
    public ResponseEntity<Integer> makeOrder(DeliveryOrder orderRequest,/*Session*/ int accountId){
        CustomerAccount account = customerAccountService.requestAccount(accountId);
        //Card
        Integer orderId = deliveryOrderService.store(orderRequest);
        if(orderId != null){
            return ResponseEntity.ok(orderId);
        }
        //Email
        return ResponseEntity.internalServerError().build();
    }

    //View Orde
    @GetMapping()
    public Invoice viewOrder(int orderId){
        return deliveryOrderService.requestInvoice(orderId);
    }

}
