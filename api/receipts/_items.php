<?php
/**
 * Shared item/total maths for a receipt.
 *
 * Two kinds of line item live side by side:
 *   • normal  (is_shared = 0) — units are claimed one by one; a unit taken
 *     by one person is gone for everyone else. Cost = unit_price × my units.
 *   • shared  (is_shared = 1) — the whole line (a mezze plate, a pitcher…)
 *     is split evenly between everyone who ticks it. A claim row of
 *     quantity 1 means "I'm in"; cost = line total ÷ number of claimers.
 *
 * Every endpoint that reports money (show, claim, pay) goes through here so
 * the three can never disagree.
 */

/** Items for a receipt, annotated for $uid. Shape is the client contract. */
function receiptItemsFor(PDO $db, int $receiptId, int $uid): array {
    $stmt = $db->prepare(
        "SELECT i.id, i.name, i.unit_price, i.quantity, i.is_shared,
                COALESCE((SELECT SUM(c.quantity) FROM receipt_claims c WHERE c.item_id = i.id), 0)          AS claimed_total,
                COALESCE((SELECT COUNT(*) FROM receipt_claims c WHERE c.item_id = i.id AND c.quantity > 0), 0) AS sharer_count,
                COALESCE((SELECT c.quantity FROM receipt_claims c WHERE c.item_id = i.id AND c.user_id = ?), 0) AS my_quantity
         FROM receipt_items i
         WHERE i.receipt_id = ?
         ORDER BY i.id"
    );
    $stmt->execute([$uid, $receiptId]);

    $items = [];
    foreach ($stmt->fetchAll() as $it) {
        $it['unit_price']    = (float)$it['unit_price'];
        $it['quantity']      = (int)$it['quantity'];
        $it['is_shared']     = (bool)(int)$it['is_shared'];
        $it['claimed_total'] = (int)$it['claimed_total'];
        $it['sharer_count']  = (int)$it['sharer_count'];
        $it['my_quantity']   = (int)$it['my_quantity'];
        $it['line_total']    = round($it['unit_price'] * $it['quantity'], 2);

        if ($it['is_shared']) {
            // No scarcity on a shared line — you're either in or out.
            $it['remaining'] = $it['quantity'];
            $it['my_share']  = $it['my_quantity'] > 0
                ? round($it['line_total'] / max(1, $it['sharer_count']), 2)
                : 0.0;
        } else {
            $it['remaining'] = max(0, $it['quantity'] - ($it['claimed_total'] - $it['my_quantity']));
            $it['my_share']  = round($it['unit_price'] * $it['my_quantity'], 2);
        }
        $items[] = $it;
    }
    return $items;
}

/** What $uid owes on this receipt, derived from the annotated items. */
function receiptTotalFor(array $items): float {
    $sum = 0.0;
    foreach ($items as $it) { $sum += $it['my_share']; }
    return round($sum, 2);
}
