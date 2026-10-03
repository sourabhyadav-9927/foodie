import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

public class FoodOrderingServer {
    // Orders live in memory and are lost when the server stops.
    static final List<String> orders = Collections.synchronizedList(new ArrayList<>());
    static final AtomicInteger orderCounter = new AtomicInteger(1000);

    static final String FOODS = """
        [
          {"id":1,"name":"Margherita Pizza","price":249,"emoji":"🍕","category":"Pizza","veg":true,"description":"Thin crust, fresh mozzarella and basil."},
          {"id":2,"name":"Farmhouse Pizza","price":299,"emoji":"🍕","category":"Pizza","veg":true,"description":"Capsicum, onion, mushroom and sweet corn."},
          {"id":3,"name":"Chicken Pepperoni Pizza","price":349,"emoji":"🍕","category":"Pizza","veg":false,"description":"Spicy chicken pepperoni with extra cheese."},
          {"id":4,"name":"Veg Burger","price":149,"emoji":"🍔","category":"Burgers","veg":true,"description":"Crispy veggie patty with house sauce."},
          {"id":5,"name":"Chicken Burger","price":189,"emoji":"🍔","category":"Burgers","veg":false,"description":"Juicy fried chicken with lettuce and mayo."},
          {"id":6,"name":"Masala Dosa","price":129,"emoji":"🥞","category":"Indian","veg":true,"description":"Crisp dosa with potato masala, sambar and chutney."},
          {"id":7,"name":"Paneer Biryani","price":219,"emoji":"🍚","category":"Indian","veg":true,"description":"Fragrant basmati rice with spiced paneer."},
          {"id":8,"name":"Chicken Biryani","price":259,"emoji":"🍗","category":"Indian","veg":false,"description":"Slow-cooked dum biryani with raita."},
          {"id":9,"name":"French Fries","price":99,"emoji":"🍟","category":"Snacks","veg":true,"description":"Golden, salted and served hot."},
          {"id":10,"name":"Cold Coffee","price":119,"emoji":"🥤","category":"Drinks","veg":true,"description":"Thick, chilled coffee with ice cream."},
          {"id":11,"name":"Fresh Lime Soda","price":69,"emoji":"🍋","category":"Drinks","veg":true,"description":"Sweet or salted, your choice."}
        ]
        """;

    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
         HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        server.createContext("/api/foods", exchange -> handle(exchange, () -> {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                send(exchange, 405, "{\"message\":\"Method not allowed\"}");
                return;
            }
            send(exchange, 200, FOODS);
        }));

        server.createContext("/api/orders", exchange -> handle(exchange, () -> {
            String method = exchange.getRequestMethod().toUpperCase();
            if (method.equals("POST")) {
                String body = readBody(exchange).trim();
                if (!body.startsWith("{") || !body.contains("\"customerName\"") || !body.contains("\"items\"")) {
                    send(exchange, 400, "{\"message\":\"Invalid order\"}");
                    return;
                }
                int id = orderCounter.incrementAndGet();
                String stamped = body.substring(0, body.length() - 1)
                        + ",\"orderId\":" + id + ",\"time\":\"" + LocalDateTime.now() + "\"}";
                orders.add(stamped);
                System.out.println("New order #" + id);
                send(exchange, 200, "{\"message\":\"Order placed successfully!\",\"orderId\":" + id + "}");
            } else if (method.equals("GET")) {
                synchronized (orders) {
                    send(exchange, 200, orders.toString());
                }
            } else {
                send(exchange, 405, "{\"message\":\"Method not allowed\"}");
            }
        }));

        server.start();
        System.out.println("Foodie Java server running at http://localhost:8080");
    }

    interface Action { void run() throws IOException; }

    // Adds CORS headers and answers browser preflight (OPTIONS) requests.
    static void handle(HttpExchange exchange, Action action) throws IOException {
        try {
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            action.run();
        } catch (Exception e) {
            e.printStackTrace();
            send(exchange, 500, "{\"message\":\"Server error\"}");
        } finally {
            exchange.close();
        }
    }

    static String readBody(HttpExchange exchange) throws IOException {
        return new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    }

    static void send(HttpExchange exchange, int code, String response) throws IOException {
        byte[] data = response.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(code, data.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(data);
        }
    }
}
