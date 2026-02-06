# EvmTransferData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Type** | **string** |  | 
**To** | **string** | Recipient or token contract address | 
**Value** | **string** | Native currency amount (wei) | 
**Data** | **string** | Calldata (0x for native, ABI-encoded for ERC20) | 
**ChainId** | **int32** |  | 
**TokenContract** | Pointer to **string** |  | [optional] 

## Methods

### NewEvmTransferData

`func NewEvmTransferData(type_ string, to string, value string, data string, chainId int32, ) *EvmTransferData`

NewEvmTransferData instantiates a new EvmTransferData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewEvmTransferDataWithDefaults

`func NewEvmTransferDataWithDefaults() *EvmTransferData`

NewEvmTransferDataWithDefaults instantiates a new EvmTransferData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetType

`func (o *EvmTransferData) GetType() string`

GetType returns the Type field if non-nil, zero value otherwise.

### GetTypeOk

`func (o *EvmTransferData) GetTypeOk() (*string, bool)`

GetTypeOk returns a tuple with the Type field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetType

`func (o *EvmTransferData) SetType(v string)`

SetType sets Type field to given value.


### GetTo

`func (o *EvmTransferData) GetTo() string`

GetTo returns the To field if non-nil, zero value otherwise.

### GetToOk

`func (o *EvmTransferData) GetToOk() (*string, bool)`

GetToOk returns a tuple with the To field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTo

`func (o *EvmTransferData) SetTo(v string)`

SetTo sets To field to given value.


### GetValue

`func (o *EvmTransferData) GetValue() string`

GetValue returns the Value field if non-nil, zero value otherwise.

### GetValueOk

`func (o *EvmTransferData) GetValueOk() (*string, bool)`

GetValueOk returns a tuple with the Value field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetValue

`func (o *EvmTransferData) SetValue(v string)`

SetValue sets Value field to given value.


### GetData

`func (o *EvmTransferData) GetData() string`

GetData returns the Data field if non-nil, zero value otherwise.

### GetDataOk

`func (o *EvmTransferData) GetDataOk() (*string, bool)`

GetDataOk returns a tuple with the Data field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetData

`func (o *EvmTransferData) SetData(v string)`

SetData sets Data field to given value.


### GetChainId

`func (o *EvmTransferData) GetChainId() int32`

GetChainId returns the ChainId field if non-nil, zero value otherwise.

### GetChainIdOk

`func (o *EvmTransferData) GetChainIdOk() (*int32, bool)`

GetChainIdOk returns a tuple with the ChainId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChainId

`func (o *EvmTransferData) SetChainId(v int32)`

SetChainId sets ChainId field to given value.


### GetTokenContract

`func (o *EvmTransferData) GetTokenContract() string`

GetTokenContract returns the TokenContract field if non-nil, zero value otherwise.

### GetTokenContractOk

`func (o *EvmTransferData) GetTokenContractOk() (*string, bool)`

GetTokenContractOk returns a tuple with the TokenContract field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTokenContract

`func (o *EvmTransferData) SetTokenContract(v string)`

SetTokenContract sets TokenContract field to given value.

### HasTokenContract

`func (o *EvmTransferData) HasTokenContract() bool`

HasTokenContract returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


