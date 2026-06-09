/**
 * Verifies that the ?status= search param drives the active SD approval tab
 * across direct navigation AND browser back/forward (popstate).
 *
 * Uses a minimal memory-history router with the same searchSchema/fallback
 * shape as the real SD routes so the test is decoupled from routeTree.gen.
 */
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  Outlet,
} from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  status: fallback(z.enum(["pending", "accepted", "rejected"]), "pending").default("pending"),
});

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const priceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sd/price",
  validateSearch: zodValidator(searchSchema),
  component: function PricePage() {
    const { status } = priceRoute.useSearch();
    return <div data-testid="active-status">{status}</div>;
  },
});

function buildRouter(initial: string) {
  return createRouter({
    routeTree: rootRoute.addChildren([priceRoute]),
    history: createMemoryHistory({ initialEntries: [initial] }),
  });
}

async function flush() {
  // Allow router to settle after navigation
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("SD approval ?status= search param", () => {
  it("defaults to 'pending' when no status param is present", async () => {
    const router = buildRouter("/sd/price");
    render(<RouterProvider router={router} />);
    await flush();
    expect(screen.getByTestId("active-status").textContent).toBe("pending");
  });

  it.each(["pending", "accepted", "rejected"] as const)(
    "reads ?status=%s from the URL",
    async (status) => {
      const router = buildRouter(`/sd/price?status=${status}`);
      render(<RouterProvider router={router} />);
      await flush();
      expect(screen.getByTestId("active-status").textContent).toBe(status);
    },
  );

  it("falls back to 'pending' for invalid status values", async () => {
    const router = buildRouter("/sd/price?status=bogus");
    render(<RouterProvider router={router} />);
    await flush();
    expect(screen.getByTestId("active-status").textContent).toBe("pending");
  });

  it("updates the active tab when back/forward navigates between ?status= values", async () => {
    const router = buildRouter("/sd/price");
    render(<RouterProvider router={router} />);
    await flush();
    expect(screen.getByTestId("active-status").textContent).toBe("pending");

    // Simulate tab clicks pushing new history entries
    await act(async () => {
      await router.navigate({ to: "/sd/price", search: { status: "accepted" } });
    });
    await flush();
    expect(screen.getByTestId("active-status").textContent).toBe("accepted");

    await act(async () => {
      await router.navigate({ to: "/sd/price", search: { status: "rejected" } });
    });
    await flush();
    expect(screen.getByTestId("active-status").textContent).toBe("rejected");

    // Browser BACK → previous entry (accepted)
    await act(async () => {
      router.history.back();
    });
    await flush();
    expect(screen.getByTestId("active-status").textContent).toBe("accepted");

    // Browser BACK again → original (pending)
    await act(async () => {
      router.history.back();
    });
    await flush();
    expect(screen.getByTestId("active-status").textContent).toBe("pending");

    // Browser FORWARD → accepted
    await act(async () => {
      router.history.forward();
    });
    await flush();
    expect(screen.getByTestId("active-status").textContent).toBe("accepted");

    // Browser FORWARD again → rejected
    await act(async () => {
      router.history.forward();
    });
    await flush();
    expect(screen.getByTestId("active-status").textContent).toBe("rejected");
  });
});
