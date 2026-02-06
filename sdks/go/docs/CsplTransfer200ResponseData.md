# CsplTransfer200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Signature** | Pointer to **string** | Transaction signature | [optional] 
**NewSenderBalance** | Pointer to **string** | Updated sender encrypted balance | [optional] 
**RecipientPendingUpdated** | Pointer to **bool** | Whether recipient pending balance was updated | [optional] 

## Methods

### NewCsplTransfer200ResponseData

`func NewCsplTransfer200ResponseData() *CsplTransfer200ResponseData`

NewCsplTransfer200ResponseData instantiates a new CsplTransfer200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCsplTransfer200ResponseDataWithDefaults

`func NewCsplTransfer200ResponseDataWithDefaults() *CsplTransfer200ResponseData`

NewCsplTransfer200ResponseDataWithDefaults instantiates a new CsplTransfer200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSignature

`func (o *CsplTransfer200ResponseData) GetSignature() string`

GetSignature returns the Signature field if non-nil, zero value otherwise.

### GetSignatureOk

`func (o *CsplTransfer200ResponseData) GetSignatureOk() (*string, bool)`

GetSignatureOk returns a tuple with the Signature field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSignature

`func (o *CsplTransfer200ResponseData) SetSignature(v string)`

SetSignature sets Signature field to given value.

### HasSignature

`func (o *CsplTransfer200ResponseData) HasSignature() bool`

HasSignature returns a boolean if a field has been set.

### GetNewSenderBalance

`func (o *CsplTransfer200ResponseData) GetNewSenderBalance() string`

GetNewSenderBalance returns the NewSenderBalance field if non-nil, zero value otherwise.

### GetNewSenderBalanceOk

`func (o *CsplTransfer200ResponseData) GetNewSenderBalanceOk() (*string, bool)`

GetNewSenderBalanceOk returns a tuple with the NewSenderBalance field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNewSenderBalance

`func (o *CsplTransfer200ResponseData) SetNewSenderBalance(v string)`

SetNewSenderBalance sets NewSenderBalance field to given value.

### HasNewSenderBalance

`func (o *CsplTransfer200ResponseData) HasNewSenderBalance() bool`

HasNewSenderBalance returns a boolean if a field has been set.

### GetRecipientPendingUpdated

`func (o *CsplTransfer200ResponseData) GetRecipientPendingUpdated() bool`

GetRecipientPendingUpdated returns the RecipientPendingUpdated field if non-nil, zero value otherwise.

### GetRecipientPendingUpdatedOk

`func (o *CsplTransfer200ResponseData) GetRecipientPendingUpdatedOk() (*bool, bool)`

GetRecipientPendingUpdatedOk returns a tuple with the RecipientPendingUpdated field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRecipientPendingUpdated

`func (o *CsplTransfer200ResponseData) SetRecipientPendingUpdated(v bool)`

SetRecipientPendingUpdated sets RecipientPendingUpdated field to given value.

### HasRecipientPendingUpdated

`func (o *CsplTransfer200ResponseData) HasRecipientPendingUpdated() bool`

HasRecipientPendingUpdated returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


