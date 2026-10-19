using Hospital_CRM.Api.Services;
using Xunit;

namespace Hospital_CRM.Tests;

public class PaymentWebhookCodecTests
{
    private const string Body = "{\"txnId\":\"T1\",\"amount\":100}";

    [Fact]
    public void Matching_Secret_Verifies_Signature()
    {
        var signature = PaymentWebhookCodec.SignHmac("tenant-a-secret", Body);
        Assert.True(PaymentWebhookCodec.Verify("paytm", "tenant-a-secret", Body, signature));
    }

    [Fact]
    public void Tenant_B_Secret_Cannot_Sign_For_Tenant_A()
    {
        // B2 done-when: tenant A's webhook cannot be processed under tenant B's secret.
        var signature = PaymentWebhookCodec.SignHmac("tenant-b-secret", Body);
        Assert.False(PaymentWebhookCodec.Verify("paytm", "tenant-a-secret", Body, signature));
    }

    [Fact]
    public void Tampered_Body_Fails_Verification()
    {
        var signature = PaymentWebhookCodec.SignHmac("s", Body);
        Assert.False(PaymentWebhookCodec.Verify("paytm", "s", Body.Replace("100", "999"), signature));
    }

    [Fact]
    public void PhonePe_XVerify_Hash_With_Salt_Index_Verifies()
    {
        var hash = PaymentWebhookCodec.SignHmac("phonepe-secret", Body);
        Assert.True(PaymentWebhookCodec.Verify("phonepe", "phonepe-secret", Body, $"{hash}###1"));
    }

    [Fact]
    public void Paytm_Payload_Parses_Rupee_Amount_And_Bank_Reference()
    {
        const string body = """
        {
          "body": {
            "orderId": "ORD-1",
            "txnAmount": { "value": "1500.00", "currency": "INR" },
            "txnId": "PAY-1",
            "bankTxnId": "UTR12345",
            "status": "TXN_SUCCESS"
          }
        }
        """;

        var evt = PaymentWebhookCodec.TryParse("paytm", body);

        Assert.NotNull(evt);
        Assert.Equal(1500.00m, evt!.Amount);
        Assert.Equal("UTR12345", evt.Utr);
        Assert.Equal("PAY-1", evt.EventId);
    }

    [Fact]
    public void PhonePe_Payload_Converts_Paise_To_Rupees()
    {
        const string body = """
        {
          "event": "pg.order.completed",
          "payload": {
            "transactionId": "TX-9",
            "amount": 25000,
            "state": "COMPLETED",
            "merchantTransactionId": "M-42"
          }
        }
        """;

        var evt = PaymentWebhookCodec.TryParse("phonepe", body);

        Assert.NotNull(evt);
        Assert.Equal(250.00m, evt!.Amount);
        Assert.Equal("M-42", evt.Reference);
    }

    [Fact]
    public void Failed_Status_Returns_No_Payment_Event()
    {
        const string body = """{ "txnId": "T1", "amount": 100, "status": "TXN_FAILURE" }""";
        Assert.Null(PaymentWebhookCodec.TryParse("paytm", body));
    }

    [Fact]
    public void Malformed_Json_Returns_Null()
    {
        Assert.Null(PaymentWebhookCodec.TryParse("paytm", "not-json"));
    }
}
